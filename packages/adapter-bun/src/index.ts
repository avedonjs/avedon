import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import fs from 'node:fs'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export { tryServeSsgIsrBun, ssgHtmlPath, writeHtmlAtomic, isRegenerating, revalidatePath } from './ssg-isr.js'
export type { ServeSsgIsrBunOptions, RevalidatePathContext } from './ssg-isr.js'
export { resolveUnderRoot, ssgHtmlPathSafe } from './safe-path.js'

export type BunAdapterOptions = {
  out?: string
}

export function bunAdapter(options: BunAdapterOptions = {}): AdapterInterface {
  const out = options.out ?? 'build'
  return {
    name: '@avedon/adapter-bun',
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
      const clientCss = listClientCssHrefs(path.join(outDir, 'client', 'assets'))
      builder.writeFile(serverPath, bunServerSource(serverEntry, outDir, clientCss))
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

function bunServerSource(serverEntry: string, outDir: string, clientCss: string[]): string {
  return `import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '@avedon/server';
import { tryServeSsgIsrBun, resolveUnderRoot } from '@avedon/adapter-bun';
import * as serverApp from ${JSON.stringify(pathToImport(serverEntry, outDir))};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, 'client');

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

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return true; }
}

const port = Number(process.env.PORT || 3000);

Bun.serve({
  port,
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const rawPath = url.pathname;
      const filePath = resolveUnderRoot(clientDir, rawPath);
      if (filePath === null) {
        return new Response('Forbidden', { status: 403 });
      }
      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        existsSync(filePath) &&
        !isDir(filePath)
      ) {
        if (request.method === 'HEAD') {
          const file = Bun.file(filePath);
          return new Response(null, {
            status: 200,
            headers: { 'content-type': file.type || 'application/octet-stream' },
          });
        }
        return new Response(Bun.file(filePath));
      }

      const isr = tryServeSsgIsrBun({
        request,
        clientDir,
        pathname: url.pathname,
        routes,
        appHtml,
        clientEntry,
        clientCss,
      });
      if (isr) return isr;

      return handler(request);
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});

console.log('avedon listening on http://localhost:' + port);
`
}

export default bunAdapter
