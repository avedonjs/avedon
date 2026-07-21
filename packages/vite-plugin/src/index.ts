import { compile, compileSsr } from '@vexjs/compiler'
import { createHandler } from '@vexjs/server'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { ModuleNode, Plugin, ViteDevServer } from 'vite'
import { shouldSkip } from './shouldSkip.js'

export interface VexPluginOptions {
  root?: string
  routesId?: string
  appHtml?: string
  /** Write sibling .vex.d.ts next to sources (default true) */
  writeDts?: boolean
}

export function vex(options: VexPluginOptions = {}): Plugin {
  const root = options.root ?? process.cwd()
  const writeDts = options.writeDts !== false

  return {
    name: 'vex',
    configureServer(devServer) {
      devServer.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next()
          let pathname = req.url.split('?')[0]
          if (pathname === '/index.html') pathname = '/'
          if (shouldSkip(pathname)) return next()

          const appHtmlPath = options.appHtml ?? path.join(root, 'src/app.html')
          const appHtml = fs.readFileSync(appHtmlPath, 'utf8')
          const routesPath = options.routesId ?? pathToUrl(path.join(root, 'src/routes.ts'), root)
          const routesMod = await devServer.ssrLoadModule(routesPath)
          const routes = routesMod.routes ?? routesMod.default

          const hooks = await loadOptional(devServer, path.join(root, 'src/hooks.server.ts'))
          const errorComponent = await loadOptional(devServer, path.join(root, 'src/error.vex'))
          const notFoundComponent = await loadOptional(
            devServer,
            path.join(root, 'src/not-found.vex'),
          )

          const handler = createHandler({
            routes,
            appHtml,
            hooks: ((hooks as { default?: unknown })?.default ?? hooks) as never,
            errorComponent: ((errorComponent as { default?: unknown })?.default ??
              errorComponent) as never,
            notFoundComponent: ((notFoundComponent as { default?: unknown })?.default ??
              notFoundComponent) as never,
            clientEntry: '/src/client.ts',
          })

          const host = req.headers.host ?? 'localhost'
          const rawUrl = req.url!.replace(/^\/index\.html(?=\?|$)/, '/')
          const orig = req.url
          req.url = rawUrl
          const request = await nodeToWebRequest(req, host)
          req.url = orig
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => {
            res.setHeader(k, v)
          })
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          devServer.ssrFixStacktrace(err as Error)
          next(err)
        }
      })
    },
    resolveId(id) {
      if (id === 'virtual:vex-client-entry' || id === '\0vex-client-entry') {
        return '\0vex-client-entry'
      }
    },
    load(id) {
      if (id !== '\0vex-client-entry') return null
      return clientEntrySource()
    },
    transform(code, id, opts) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('.vex')) return null
      const filename = path.basename(cleanId)
      const result = opts?.ssr
        ? compileSsr(code, { filename })
        : compile(code, { filename, generate: 'client' })
      if (writeDts && result.dts) {
        const dtsPath = cleanId + '.d.ts'
        try {
          fs.writeFileSync(dtsPath, result.dts)
        } catch {
          // ignore write failures (read-only)
        }
      }
      return { code: result.code, map: null }
    },
    async handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.vex')) return
      const mods = new Set<ModuleNode>()
      for (const mod of ctx.modules) {
        mods.add(mod)
        mod.importers.forEach((i) => mods.add(i))
      }
      // Also invalidate SSR graph
      const ssrMod = ctx.server.moduleGraph.getModuleById(ctx.file)
      if (ssrMod) mods.add(ssrMod)
      ctx.server.ws.send({ type: 'full-reload' })
      return [...mods]
    },
  }
}

function pathToUrl(abs: string, root: string): string {
  const rel = path.relative(root, abs).replace(/\\/g, '/')
  return '/' + rel
}

async function loadOptional(server: ViteDevServer, absPath: string) {
  if (!fs.existsSync(absPath)) return undefined
  return server.ssrLoadModule(pathToUrl(absPath, server.config.root))
}

function clientEntrySource(): string {
  return `
import { installClientRouter, setClientBoot, evaluateCanActivate } from '@vexjs/runtime';
import { routes } from '/src/routes.ts';

function flatten(routes, out = []) {
  for (const r of routes) {
    out.push(r);
    if (r.children) flatten(r.children, out);
  }
  return out;
}

function match(pattern, pathname) {
  const pp = pattern.replace(/\\/+$/, '').split('/').filter(Boolean);
  const vp = pathname.replace(/\\/+$/, '').split('/').filter(Boolean);
  if (pp.includes('*')) {
    for (let i = 0; i < pp.length; i++) {
      if (pp[i] === '*') return true;
      if (pp[i].startsWith(':')) continue;
      if (pp[i] !== vp[i]) return false;
    }
  }
  if (pp.length !== vp.length) return false;
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) continue;
    if (pp[i] !== vp[i]) return false;
  }
  return true;
}

function paramsFromPath(pattern, pathname) {
  const pp = pattern.replace(/\\/+$/, '').split('/').filter(Boolean);
  const vp = pathname.replace(/\\/+$/, '').split('/').filter(Boolean);
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(vp[i] || '');
  }
  return params;
}

async function resolveMod(mod) {
  const resolved = typeof mod === 'function' ? await mod() : mod;
  return resolved?.default ?? resolved;
}

let current;

function abandon() {
  // Drop reference only — DOM is about to be replaced by applyDocument.
  current = null;
}

async function mountInto(comp, target, data, forceMount) {
  const run = comp.hydrate || comp.mount;
  if (!run) return;
  if (forceMount) {
    target.textContent = '';
    current = (comp.mount || run)(target, data);
  } else {
    current = run.call(comp, target, data);
  }
}

async function boot() {
  const route = flatten(routes).find((r) => match(r.path, location.pathname));
  if (!route) return;
  const app = document.getElementById('app');
  if (!app) return;
  if (current) {
    current.destroy?.();
    current = null;
  }

  const data = JSON.parse(document.getElementById('__VEX_DATA__')?.textContent || '{}');
  const url = new URL(location.href);
  const guard = await evaluateCanActivate(route.guard || route.canActivate, {
    params: paramsFromPath(route.path, location.pathname),
    url,
    request: new Request(url),
  });

  let outlet = app.querySelector('[data-vex-csr], [data-vex-page]');
  if (!outlet) {
    outlet = document.createElement('div');
    outlet.setAttribute('data-vex-page', '');
    app.replaceChildren(outlet);
  }
  const target = outlet;

  if (guard.type === 'deny') {
    if (!route.error) return; // keep SSR error HTML from navigate/applyDocument
    const err = await resolveMod(route.error);
    const props = { ...data, status: data.status ?? guard.status, message: data.message ?? guard.message };
    await mountInto(err, target, props, true);
    return;
  }

  const comp = await resolveMod(route.component);
  const csr = route.render === 'csr' || target.hasAttribute('data-vex-csr');
  await mountInto(comp, target, data, csr);
}

setClientBoot(() => boot(), { abandon });
installClientRouter();
boot();

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    boot();
  });
}
`
}

async function nodeToWebRequest(req: IncomingMessage, host: string): Promise<Request> {
  const url = `http://${host}${req.url}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v)
  }
  const method = req.method ?? 'GET'
  const init: RequestInit = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const buf = Buffer.concat(chunks)
    if (buf.length) {
      init.body = new Uint8Array(buf)
    }
  }
  return new Request(url, init)
}

export default vex
