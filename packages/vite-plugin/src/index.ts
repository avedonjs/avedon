import { changedBlocks, compile, compileSsr } from '@avedon/compiler'
import { createHandler } from '@avedon/server'
import { pipeWebResponse } from '@avedon/server/node'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { ModuleNode, Plugin, ViteDevServer } from 'vite'
import { shouldSkip } from './shouldSkip.js'

export interface AvedonPluginOptions {
  root?: string
  routesId?: string
  appHtml?: string
  /** Write sibling .ave.d.ts next to sources (default true) */
  writeDts?: boolean
}

export function avedon(options: AvedonPluginOptions = {}): Plugin {
  const root = options.root ?? process.cwd()
  const writeDts = options.writeDts !== false
  /** Previous `.ave` source for block-diff HMR. */
  const prevAvedonSource = new Map<string, string>()
  let isDev = false

  return {
    name: 'avedon',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
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
          const serverEntry = await loadOptional(devServer, path.join(root, 'src/server-entry.ts'))
          const errorComponent = await loadOptional(devServer, path.join(root, 'src/error.ave'))
          const notFoundComponent = await loadOptional(
            devServer,
            path.join(root, 'src/not-found.ave'),
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
            session: (serverEntry as { session?: unknown } | null)?.session as never,
          })

          const host = req.headers.host ?? 'localhost'
          const rawUrl = req.url!.replace(/^\/index\.html(?=\?|$)/, '/')
          const orig = req.url
          req.url = rawUrl
          const request = await nodeToWebRequest(req, host)
          req.url = orig
          const response = await handler(request)
          await pipeWebResponse(res, response)
        } catch (err) {
          devServer.ssrFixStacktrace(err as Error)
          next(err)
        }
      })
    },
    resolveId(id) {
      if (id === 'virtual:avedon-client-entry' || id === '\0avedon-client-entry') {
        return '\0avedon-client-entry'
      }
    },
    load(id) {
      if (id !== '\0avedon-client-entry') return null
      return clientEntrySource(isDev)
    },
    transform(code, id, opts) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('.ave')) return null
      if (!prevAvedonSource.has(cleanId)) prevAvedonSource.set(cleanId, code)
      const filename = path.basename(cleanId)
      const result = opts?.ssr
        ? compileSsr(code, { filename })
        : compile(code, { filename, generate: 'client', hmr: isDev && !opts?.ssr })
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
      if (!ctx.file.endsWith('.ave')) return
      const next = await ctx.read()
      const prev = prevAvedonSource.get(ctx.file) ?? next
      prevAvedonSource.set(ctx.file, next)

      const changed = changedBlocks(prev, next)
      const mods = new Set<ModuleNode>()
      for (const mod of ctx.modules) {
        mods.add(mod)
        mod.importers.forEach((i) => mods.add(i))
      }
      const ssrMod = ctx.server.moduleGraph.getModuleById(ctx.file)
      if (ssrMod) mods.add(ssrMod)

      // Server script change → full reload (intentional).
      if (changed.has('server')) {
        ctx.server.ws.send({ type: 'full-reload' })
        return [...mods]
      }

      // Client / template / style → state-preserving custom HMR (no full-reload).
      if (changed.size > 0) {
        ctx.server.ws.send({
          type: 'custom',
          event: 'avedon:update',
          data: { file: ctx.file, timestamp: Date.now() },
        })
      }
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

function clientEntrySource(isDev: boolean): string {
  const hmrBlock = isDev
    ? `
if (import.meta.hot) {
  import.meta.hot.on('avedon:update', async (payload) => {
    const state = current?.getHmrState?.() ?? null;
    const ts = (payload && payload.timestamp) || Date.now();
    try {
      const routesMod = await import(/* @vite-ignore */ '/src/routes.ts?t=' + ts);
      routes = routesMod.routes ?? routesMod.default ?? routes;
    } catch {
      // keep previous routes table
    }
    await boot(state);
  });
}
`
    : ''

  return `
import {
  installClientRouter,
  setClientBoot,
  evaluateCanActivate,
  ${isDev ? '__hmrPrepareSignals,' : ''}
} from '@avedon/runtime';
import { routes as initialRoutes } from '/src/routes.ts';

let routes = initialRoutes;

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

async function boot(hmrState) {
  const route = flatten(routes).find((r) => match(r.path, location.pathname));
  if (!route) return;
  const app = document.getElementById('app');
  if (!app) return;
  if (current) {
    current.destroy?.();
    current = null;
  }

  let data = JSON.parse(document.getElementById('__AVEDON_DATA__')?.textContent || '{}');
  if (hmrState && hmrState.data !== undefined) {
    data = { ...data, data: hmrState.data };
  }
  ${isDev ? `if (hmrState?.signals) { __hmrPrepareSignals(hmrState.signals); }` : ''}

  const url = new URL(location.href);
  const guard = await evaluateCanActivate(route.guard || route.canActivate, {
    params: paramsFromPath(route.path, location.pathname),
    url,
    request: new Request(url),
  });

  let outlet = app.querySelector('[data-avedon-csr], [data-avedon-page]');
  if (!outlet) {
    outlet = document.createElement('div');
    outlet.setAttribute('data-avedon-page', '');
    app.replaceChildren(outlet);
  }
  const target = outlet;

  if (guard.type === 'deny') {
    if (!route.error) return;
    const err = await resolveMod(route.error);
    const props = { ...data, status: data.status ?? guard.status, message: data.message ?? guard.message };
    await mountInto(err, target, props, true);
    return;
  }

  const comp = await resolveMod(route.component);
  const force = Boolean(hmrState) || route.render === 'csr' || target.hasAttribute('data-avedon-csr');
  await mountInto(comp, target, data, force);
}

setClientBoot(() => boot(), { abandon });
installClientRouter();
boot();
${hmrBlock}
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

export default avedon
