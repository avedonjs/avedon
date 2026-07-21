import { HttpError, isHttpError } from './errors.js'
import { matchRoute, type MatchResult } from './match.js'
import { renderShell, resolveComponent } from './ssr.js'
import type {
  ApiHandler,
  HandlerOptions,
  LoadEvent,
  RouteConfig,
  VexComponentModule,
} from './types.js'

export function createHandler(options: HandlerOptions) {
  const resolve = async (request: Request): Promise<Response> => {
    try {
      return await handleRequest(request, options)
    } catch (err) {
      if (err instanceof Response) return err
      if (isHttpError(err)) {
        return renderError(options, err.status, err.body, request, null)
      }
      console.error(err)
      return renderError(options, 500, 'Internal Server Error', request, null)
    }
  }

  const handle = options.hooks?.handle
  if (!handle) return resolve

  return (request: Request) =>
    handle({
      request,
      resolve,
    })
}

async function handleRequest(request: Request, options: HandlerOptions): Promise<Response> {
  const url = new URL(request.url)

  const absApi = await tryAbsoluteApi(request, url, options)
  if (absApi) return absApi

  const accept = request.headers.get('accept') || ''
  const wantsJson =
    url.pathname.endsWith('.json') ||
    (accept.includes('application/json') && !accept.includes('text/html'))

  const pagePath = url.pathname.endsWith('.json')
    ? url.pathname.slice(0, -'.json'.length) || '/'
    : url.pathname

  const matched = matchRoute(options.routes, pagePath)
  if (!matched) {
    return renderNotFound(options, request, null)
  }

  const event: LoadEvent = {
    params: matched.params,
    request,
    url,
  }

  for (const route of matched.chain) {
    if (route.canMatch) {
      const g = await route.canMatch(event)
      if (g === false) return renderNotFound(options, request, matched)
      if (g instanceof Response) return g
    }
  }

  for (const route of matched.chain) {
    const guardFn = route.guard ?? route.canActivate
    if (guardFn) {
      const g = await guardFn(event)
      if (g === false) {
        return renderError(options, 403, 'Forbidden', request, matched)
      }
      if (g instanceof Response) return g
    }
  }

  const component = await resolveComponent(matched.route.component)

  if (wantsJson) {
    const method = request.method.toUpperCase()
    const handler = pickApiHandler(component, method)
    if (handler) return handler(event)
  }

  if (request.method === 'POST') {
    const actionName = getActionName(url)
    if (actionName != null && component.actions) {
      const handler = component.actions[actionName] ?? component.actions.default
      if (!handler) throw new HttpError(404, `Action ${actionName} not found`)
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        formData = new FormData()
      }
      const result = await handler({ ...event, formData })
      if (result instanceof Response) return result
      const extra =
        result && typeof result === 'object' && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : { result }
      return renderPage(options, matched, component, event, extra)
    }
  }

  return renderPage(options, matched, component, event)
}

function pickApiHandler(component: VexComponentModule, method: string): ApiHandler | undefined {
  const key = `api_${method}` as keyof VexComponentModule
  const named = component[key]
  if (typeof named === 'function') return named as ApiHandler
  if (component.api) {
    if (component.api[method]) return component.api[method]
    const found = Object.keys(component.api).find((k) => k.toUpperCase() === method)
    if (found) return component.api[found]
  }
  return undefined
}

async function tryAbsoluteApi(
  request: Request,
  url: URL,
  options: HandlerOptions,
): Promise<Response | null> {
  const key = `${request.method.toUpperCase()} ${url.pathname}`
  const apis = await collectApis(options.routes)
  const handler = apis.get(key)
  if (!handler) return null
  const event: LoadEvent = { params: {}, request, url }
  return handler(event)
}

async function collectApis(
  routes: RouteConfig[],
  map = new Map<string, ApiHandler>(),
): Promise<Map<string, ApiHandler>> {
  for (const route of routes) {
    const mod = await resolveComponent(route.component)
    if (mod.api) {
      for (const [k, v] of Object.entries(mod.api)) {
        // Absolute keys look like "GET /api/items"; method-only keys are route-relative.
        if (/\s\//.test(k.trim())) map.set(normalizeApiKey(k), v)
      }
    }
    if (route.children) await collectApis(route.children, map)
  }
  return map
}

function normalizeApiKey(key: string): string {
  const parts = key.trim().split(/\s+/)
  if (parts.length !== 2) return key
  return `${parts[0].toUpperCase()} ${parts[1]}`
}

function getActionName(url: URL): string | null {
  const viaParam = url.searchParams.get('_action')
  if (viaParam != null) return viaParam || 'default'
  for (const key of url.searchParams.keys()) {
    if (key.startsWith('/')) {
      const name = key.slice(1)
      return name || 'default'
    }
  }
  if (url.search.startsWith('?/')) {
    return url.search.slice(2).split('&')[0] || 'default'
  }
  // POST without explicit action → default
  return 'default'
}

async function renderPage(
  options: HandlerOptions,
  matched: MatchResult,
  component: VexComponentModule,
  event: LoadEvent,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  const route = matched.route
  const mode = route.render ?? 'ssr'

  let data: Record<string, unknown> = {}
  if (mode !== 'csr' && component.load) {
    const loaded = await component.load(event)
    if (loaded instanceof Response) return loaded
    if (loaded) data = { ...data, ...loaded }
  }
  data = { ...data, ...extra }

  const cssParts: string[] = []
  if (component.css) cssParts.push(component.css)

  let body: string
  if (mode === 'csr') {
    body = `<div data-vex-csr></div>`
  } else {
    body = `<div data-vex-page>${component.render(data)}</div>`
  }
  for (let i = matched.chain.length - 1; i >= 0; i--) {
    const r = matched.chain[i]
    if (!r.layout) continue
    const layout = await resolveComponent(r.layout)
    if (layout.css) cssParts.push(layout.css)
    body = layout.render({ ...data, children: body })
  }

  if (options.getCss?.()) cssParts.push(options.getCss())

  const html = renderShell(options.appHtml, {
    body,
    css: cssParts.filter(Boolean).join('\n'),
    props: data,
    clientEntry: options.clientEntry,
  })
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function pickRouteComponent(
  matched: MatchResult | null,
  kind: 'error' | 'notFound',
  globalMod?: VexComponentModule,
): VexComponentModule | undefined {
  if (matched) {
    for (let i = matched.chain.length - 1; i >= 0; i--) {
      const c = matched.chain[i][kind]
      if (c) return c
    }
  }
  return globalMod
}

async function renderNotFound(
  options: HandlerOptions,
  request: Request,
  matched: MatchResult | null,
): Promise<Response> {
  const mod = pickRouteComponent(matched, 'notFound', options.notFoundComponent)
  if (mod) {
    const c = await resolveComponent(mod)
    const body = `<div data-vex-page>${c.render({ url: request.url })}</div>`
    const html = renderShell(options.appHtml, {
      body,
      css: c.css,
      props: {},
    })
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  return new Response('Not Found', { status: 404 })
}

async function renderError(
  options: HandlerOptions,
  status: number,
  message: string,
  _request: Request,
  matched: MatchResult | null,
): Promise<Response> {
  const mod = pickRouteComponent(matched, 'error', options.errorComponent)
  if (mod) {
    const c = await resolveComponent(mod)
    const body = `<div data-vex-page>${c.render({ status, message })}</div>`
    const html = renderShell(options.appHtml, {
      body,
      css: c.css,
      props: { status, message },
    })
    return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  return new Response(message, { status })
}

export { matchRoute, paramsFromPath } from './match.js'
export { HttpError, isHttpError, notFound, error, redirect, json } from './errors.js'
export { renderShell, resolveComponent } from './ssr.js'
export { defineRoutes } from './types.js'
