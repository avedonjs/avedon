import type { AdapterBuilder, AdapterInterface } from '@vexjs/shared'
import fs from 'node:fs'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export function nodeAdapter(options: { out?: string } = {}): AdapterInterface {
  const out = options.out ?? 'build'
  return {
    name: '@vexjs/adapter-node',
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
      builder.writeFile(serverPath, nodeServerSource(serverEntry, outDir, manifest))
    },
  }
}

function pathToImport(serverEntry: string, outDir: string): string {
  let rel = path.relative(outDir, serverEntry).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function nodeServerSource(serverEntry: string, outDir: string, manifest: string): string {
  return `import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '@vexjs/server';
import * as serverApp from ${JSON.stringify(pathToImport(serverEntry, outDir))};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, 'client');
const manifest = ${manifest};
void manifest;

const handler = createHandler({
  routes: serverApp.routes ?? serverApp.default,
  appHtml: serverApp.appHtml,
  hooks: serverApp.hooks,
  errorComponent: serverApp.errorComponent,
  notFoundComponent: serverApp.notFoundComponent,
  clientEntry: '/assets/client.js',
});

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return true; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const filePath = path.join(clientDir, decodeURIComponent(url.pathname));
    if (existsSync(filePath) && !isDir(filePath) && req.method === 'GET') {
      createReadStream(filePath).pipe(res);
      return;
    }
    const ssg = path.join(
      clientDir,
      url.pathname === '/' ? 'index.html' : path.join(url.pathname.replace(/^\\//, ''), 'index.html'),
    );
    if (existsSync(ssg) && req.method === 'GET') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      createReadStream(ssg).pipe(res);
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
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

export function listen(port = Number(process.env.PORT || 3000)) {
  return server.listen(port, () => console.log('vexjs listening on http://localhost:' + port));
}

listen();
`
}

export default nodeAdapter
