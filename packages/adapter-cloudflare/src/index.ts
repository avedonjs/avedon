import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import fs from 'node:fs'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export type CloudflareAdapterOptions = {
  out?: string
  name?: string
}

export function cloudflareAdapter(options: CloudflareAdapterOptions = {}): AdapterInterface {
  const out = options.out ?? 'build'
  const name = options.name ?? 'avedon-app'
  return {
    name: '@avedon/adapter-cloudflare',
    async adapt(builder) {
      const outDir = path.resolve(out)
      const clientDir = path.join(outDir, 'client')
      const serverDir = path.join(outDir, 'server')

      builder.mkdirp(outDir)
      builder.mkdirp(clientDir)
      builder.writeClient(clientDir)

      for (const page of builder.getSsgPages()) {
        const file = ssgHtmlPath(clientDir, page.path)
        builder.mkdirp(path.dirname(file))
        builder.writeFile(file, page.html)
      }

      const serverEntry = builder.getServerEntry()
      builder.mkdirp(serverDir)
      const entryDir = path.dirname(serverEntry)
      fs.cpSync(entryDir, serverDir, { recursive: true })

      const routes = (builder.getManifest().routes ?? []) as Array<{
        path?: string
        render?: string
        revalidate?: number
      }>
      if (routes.some((r) => r.revalidate != null && r.revalidate > 0)) {
        console.warn(
          '[@avedon/adapter-cloudflare] revalidate/ISR is not supported on Workers in v1; SSG pages are static until redeploy.',
        )
      }

      builder.writeFile(path.join(outDir, 'worker.js'), workerSource())
      builder.writeFile(path.join(outDir, 'wrangler.jsonc'), wranglerSource(name))
    },
  }
}

export function ssgHtmlPath(clientDir: string, routePath: string): string {
  const normalized = routePath.split('?')[0] || '/'
  if (normalized.includes('\0')) throw new Error('Invalid SSG path')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((p) => p === '..' || p === '.')) {
    throw new Error(`Unsafe SSG path: ${routePath}`)
  }
  if (parts.length === 0) return path.join(clientDir, 'index.html')
  return path.join(clientDir, ...parts, 'index.html')
}

function workerSource(): string {
  return `import { createHandler } from '@avedon/server';
import * as serverApp from './server/index.js';

const routes = serverApp.routes ?? serverApp.default;
const appHtml = serverApp.appHtml;
const clientEntry = '/assets/client.js';

function resolveSession(env) {
  const base = serverApp.session;
  if (!base) return undefined;
  if (base.secret) return base;
  const secret = env.SESSION_SECRET;
  if (!secret) return base;
  return { ...base, secret };
}

export default {
  async fetch(request, env, ctx) {
    const handler = createHandler({
      routes,
      appHtml,
      hooks: serverApp.hooks,
      errorComponent: serverApp.errorComponent,
      notFoundComponent: serverApp.notFoundComponent,
      clientEntry,
      session: resolveSession(env),
    });
    return handler(request);
  },
};
`
}

function wranglerSource(name: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `{
  "name": ${JSON.stringify(name)},
  "main": "./worker.js",
  "compatibility_date": ${JSON.stringify(date)},
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./client",
    "binding": "ASSETS"
  }
}
`
}

export default cloudflareAdapter
