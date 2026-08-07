import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import fs from 'node:fs'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export { tryServeSsgIsr, ssgHtmlPath, writeHtmlAtomic, isRegenerating, revalidatePath } from './ssg-isr.js'
export type { ServeSsgIsrOptions, RevalidatePathContext } from './ssg-isr.js'
export { resolveUnderRoot, ssgHtmlPathSafe } from './safe-path.js'

export function nodeAdapter(options: { out?: string } = {}): AdapterInterface {
  const out = options.out ?? 'build'
  return {
    name: '@avedon/adapter-node',
    async adapt(builder) {
      const outDir = path.resolve(out)
      builder.mkdirp(outDir)
      builder.mkdirp(path.join(outDir, 'client'))
      builder.writeClient(path.join(outDir, 'client'))

      for (const page of builder.getSsgPages()) {
        const file =
          page.path === '/'
            ? path.join(outDir, 'client', 'index.html')
            : path.join(outDir, 'client', page.path.replace(/^\//, ''), 'index.html')
        builder.mkdirp(path.dirname(file))
        builder.writeFile(file, page.html)
      }

      const serverPath = path.join(outDir, 'server.js')
      const serverEntry = builder.getServerEntry()
      const manifest = JSON.stringify(builder.getManifest(), null, 2)
      const clientCss = listClientCssHrefs(path.join(outDir, 'client', 'assets'))
      builder.writeFile(serverPath, nodeServerSource(serverEntry, outDir, manifest, clientCss))
    },
  }
}

function listClientCssHrefs(assetsDir: string): string[] {
  if (!fs.existsSync(assetsDir)) return []
  return fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => `/assets/${name}`)
}

function pathToImport(serverEntry: string, outDir: string): string {
  let rel = path.relative(outDir, serverEntry).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function nodeServerSource(
  serverEntry: string,
  outDir: string,
  manifest: string,
  clientCss: string[],
): string {
  return `import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '@avedon/server';
import { tryServeSsgIsr, resolveUnderRoot } from '@avedon/adapter-node';
import { Readable } from 'node:stream';
import * as serverApp from ${JSON.stringify(pathToImport(serverEntry, outDir))};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, 'client');
const manifest = ${manifest};
void manifest;

const routes = serverApp.routes ?? serverApp.default;
const appHtml = serverApp.appHtml;
const clientEntry = '/assets/client.js';
const clientCss = ${JSON.stringify(clientCss)};

const handler = createHandler({
  routes,
  appHtml,
  hooks: serverApp.hooks,
  errorComponent: serverApp.errorComponent,
  notFoundComponent: serverApp.notFoundComponent,
  clientEntry,
  clientCss,
  session: serverApp.session,
});

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return STATIC_TYPES[ext] || 'application/octet-stream';
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return true; }
}

async function pipeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  await new Promise((resolve, reject) => {
    nodeStream.on('error', reject);
    res.on('error', reject);
    res.on('finish', resolve);
    nodeStream.pipe(res);
  });
}

const server = createServer(async (req, res) => {
  try {
    // Reject unsafe static paths before WHATWG URL parsing (which can throw on %00
    // or strip ".." segments).
    const rawPath = (req.url || '/').split('?')[0] || '/';
    const filePath = resolveUnderRoot(clientDir, rawPath);
    if (filePath === null) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    if (existsSync(filePath) && !isDir(filePath) && req.method === 'GET') {
      res.setHeader('Content-Type', contentTypeFor(filePath));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      createReadStream(filePath).pipe(res);
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    if (
      tryServeSsgIsr({
        req,
        res,
        clientDir,
        pathname: url.pathname,
        routes,
        appHtml,
        clientEntry,
        clientCss,
      })
    ) {
      return;
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    }
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(chunks);
    const request = new Request(url, { method: req.method, headers, body });
    const response = await handler(request);
    await pipeResponse(res, response);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

export function listen(port = Number(process.env.PORT || 3000)) {
  return server.listen(port, () => console.log('avedon listening on http://localhost:' + port));
}

listen();
`
}

export default nodeAdapter
