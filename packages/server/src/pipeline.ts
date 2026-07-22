import { assertCsrf } from './csrf.js'
import { HttpError, isHttpError } from './errors.js'
import { matchRoute, type MatchResult } from './match.js'
import { sequence } from './sequence.js'
import {
  renderShell,
  renderShellPrefix,
  renderShellSuffixFromTemplate,
  resolveComponent,
} from './ssr.js'
import type {
  ApiHandler,
  HandlerOptions,
  LoadEvent,
  Middleware,
  RouteConfig,
  AvedonComponentModule,
} from './types.js'
import { createRenderStream, escapeHtml, streamToString, type RenderStreamController } from '@avedon/runtime'
import { buildRequestContext, validateSessionOptions } from './session.js'

/** Wait up to this long for `load()` before flushing the HTML shell (streaming SSR default). */
const SSR_SHELL_FLUSH_MS = 40

type LoadOutcome =
  | { kind: 'pending' }
  | { kind: 'data'; data: Record<string, unknown> }
  | { kind: 'response'; response: Response }
  | { kind: 'throw'; err: unknown }

function startLoadOutcome(
  component: AvedonComponentModule,
  event: LoadEvent,
  extra: Record<string, unknown>,
): { promise: Promise<void>; get: () => LoadOutcome } {
  let outcome: LoadOutcome = { kind: 'pending' }
  const promise = (async () => {
    if (!component.load) {
      outcome = { kind: 'data', data: { ...extra } }
      return
    }
    try {
      const loaded = await component.load(event)
      if (loaded instanceof Response) {
        outcome = { kind: 'response', response: loaded }
        return
      }
      let data: Record<string, unknown> = { ...extra }
      if (loaded) data = { ...data, ...loaded }
      outcome = { kind: 'data', data }
    } catch (err) {
      outcome = { kind: 'throw', err }
    }
  })()
  return { promise, get: () => outcome }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function clientRedirectScript(response: Response): string {
  const loc = response.headers.get('Location') ?? '/'
  return `<script>window.location.href=${JSON.stringify(loc)}</script>`
}

async function responseFromLoadOutcome(
  options: HandlerOptions,
  matched: MatchResult,
  request: Request,
  outcome: Extract<LoadOutcome, { kind: 'response' | 'throw' }>,
): Promise<Response> {
  if (outcome.kind === 'response') return outcome.response
  const err = outcome.err
  if (err instanceof Response) return err
  if (isHttpError(err)) return renderHttpError(options, err, request, matched)
  throw err
}

async function writeLoadFailureIntoStream(
  ctrl: RenderStreamController,
  options: HandlerOptions,
  matched: MatchResult,
  request: Request,
  err: unknown,
): Promise<void> {
  if (err instanceof Response) {
    ctrl.enqueueHtml(clientRedirectScript(err))
    return
  }
  if (isHttpError(err)) {
    if (err.status === 404) {
      const mod = pickRouteComponent(matched, 'notFound', options.notFoundComponent)
      if (mod) {
        const c = await resolveComponent(mod)
        ctrl.enqueueHtml(`<div data-avedon-page>${c.render({ url: request.url })}</div>`)
        return
      }
      ctrl.enqueueHtml('<div data-avedon-page><p>Not Found</p></div>')
      return
    }
    const mod = pickRouteComponent(matched, 'error', options.errorComponent)
    if (mod) {
      const c = await resolveComponent(mod)
      ctrl.enqueueHtml(
        `<div data-avedon-page>${c.render({ status: err.status, message: err.body })}</div>`,
      )
      return
    }
    ctrl.enqueueHtml(
      `<div data-avedon-page><p>${escapeHtml(err.body || `HTTP ${err.status}`)}</p></div>`,
    )
    return
  }
  throw err
}

export function createHandler(options: HandlerOptions) {
  validateSessionOptions(options.session)

  const resolve = async (request: Request): Promise<Response> => {
    try {
      return await handleRequest(request, options)
    } catch (err) {
      if (err instanceof Response) return err
      if (isHttpError(err)) {
        return renderHttpError(options, err, request, null)
      }
      console.error(err)
      return renderError(options, 500, 'Internal Server Error', request, null)
    }
  }

  const middleware = options.hooks?.middleware ?? []
  const handle = options.hooks?.handle
  const chain: Middleware[] = [...middleware, ...(handle ? [handle] : [])]
  if (chain.length === 0) return resolve

  const wrapped = sequence(...chain)
  return (request: Request) =>
    wrapped({
      request,
      resolve,
    })
}

function renderHttpError(
  options: HandlerOptions,
  err: HttpError,
  request: Request,
  matched: MatchResult | null,
): Promise<Response> {
  if (err.status === 404) {
    return renderNotFound(options, request, matched)
  }
  return renderError(options, err.status, err.body, request, matched)
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

  try {
    return await dispatchMatched(request, url, options, matched, wantsJson)
  } catch (err) {
    if (err instanceof Response) return err
    if (isHttpError(err)) {
      return renderHttpError(options, err, request, matched)
    }
    throw err
  }
}

async function dispatchMatched(
  request: Request,
  url: URL,
  options: HandlerOptions,
  matched: MatchResult,
  wantsJson: boolean,
): Promise<Response> {
  const { event, finalize } = await buildRequestContext(
    request,
    url,
    matched.params,
    options.session,
  )

  for (const route of matched.chain) {
    if (route.canMatch) {
      const g = await route.canMatch(event)
      if (g === false) return finalize(await renderNotFound(options, request, matched))
      if (g instanceof Response) return finalize(g)
    }
  }

  for (const route of matched.chain) {
    const guardFn = route.guard ?? route.canActivate
    if (guardFn) {
      const g = await guardFn(event)
      if (g === false) {
        return finalize(await renderError(options, 403, 'Forbidden', request, matched))
      }
      if (g instanceof Response) return finalize(g)
    }
  }

  const component = await resolveComponent(matched.route.component)

  if (wantsJson) {
    const method = request.method.toUpperCase()
    const handler = pickApiHandler(component, method)
    if (handler) return finalize(await handler(event))
  }

  if (request.method === 'POST') {
    const actionName = getActionName(url)
    if (actionName != null && component.actions) {
      assertCsrf(request, options.csrf)
      const handler = component.actions[actionName] ?? component.actions.default
      if (!handler) throw new HttpError(404, `Action ${actionName} not found`)
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        formData = new FormData()
      }
      try {
        const result = await handler({ ...event, formData })
        if (result instanceof Response) return finalize(result)
        const extra =
          result && typeof result === 'object' && !Array.isArray(result)
            ? (result as Record<string, unknown>)
            : { result }
        return finalize(await renderPage(options, matched, component, event, extra))
      } catch (err) {
        if (err instanceof Response) return finalize(err)
        throw err
      }
    }
  }

  return finalize(await renderPage(options, matched, component, event))
}

function pickApiHandler(component: AvedonComponentModule, method: string): ApiHandler | undefined {
  const key = `api_${method}` as keyof AvedonComponentModule
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
  const { event, finalize } = await buildRequestContext(request, url, {}, options.session)
  return finalize(await handler(event))
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
  component: AvedonComponentModule,
  event: LoadEvent,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  const route = matched.route
  const mode = route.render ?? 'ssr'

  const cssParts: string[] = []
  if (component.css) cssParts.push(component.css)

  if (mode === 'csr') {
    let data: Record<string, unknown> = { ...extra }
    if (component.load) {
      const loaded = await component.load(event)
      if (loaded instanceof Response) return loaded
      if (loaded) data = { ...data, ...loaded }
    }
    const body = `<div data-avedon-csr"></div>`
    for (let i = matched.chain.length - 1; i >= 0; i--) {
      const r = matched.chain[i]
      if (!r.layout) continue
      const layout = await resolveComponent(r.layout)
      if (layout.css) cssParts.push(layout.css)
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

  // Resolve layouts up-front for CSS + writers
  const layouts: AvedonComponentModule[] = []
  for (let i = matched.chain.length - 1; i >= 0; i--) {
    const r = matched.chain[i]
    if (!r.layout) continue
    const layout = await resolveComponent(r.layout)
    layouts.push(layout)
    if (layout.css) cssParts.push(layout.css)
  }
  if (options.getCss?.()) cssParts.push(options.getCss())

  const css = cssParts.filter(Boolean).join('\n')

  if (route.bufferHtml) {
    let data: Record<string, unknown> = { ...extra }
    if (component.load) {
      const loaded = await component.load(event)
      if (loaded instanceof Response) return loaded
      if (loaded) data = { ...data, ...loaded }
    }
    const body = await renderPageBodyBuffered(component, data, layouts)
    const html = renderShell(options.appHtml, {
      body,
      css,
      props: data,
      clientEntry: options.clientEntry,
    })
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  const prefix = renderShellPrefix(options.appHtml, { css })

  const buildWriters = (data: Record<string, unknown>) => {
    let writeBody: (ctrl: RenderStreamController) => Promise<void> = async (ctrl) => {
      ctrl.enqueueHtml('<div data-avedon-page>')
      await writeComponent(component, data, ctrl)
      ctrl.enqueueHtml('</div>')
    }
    for (const layout of layouts) {
      const inner = writeBody
      writeBody = async (ctrl) => {
        await writeComponent(layout, { ...data, children: inner }, ctrl)
      }
    }
    return writeBody
  }

  const suffixFor = (data: Record<string, unknown>) =>
    renderShellSuffixFromTemplate(options.appHtml, {
      props: data,
      clientEntry: options.clientEntry,
    })

  const { promise: loadPromise, get: getLoadOutcome } = startLoadOutcome(component, event, extra)
  await Promise.race([loadPromise, sleep(SSR_SHELL_FLUSH_MS)])

  const early = getLoadOutcome()
  if (early.kind === 'response' || early.kind === 'throw') {
    return responseFromLoadOutcome(options, matched, event.request, early)
  }

  if (early.kind === 'data') {
    const writeBody = buildWriters(early.data)
    const ctrl = createRenderStream()
    const stream = ctrl.stream
    void (async () => {
      try {
        ctrl.enqueueHtml(prefix)
        await writeBody(ctrl)
        await ctrl.waitPending()
        ctrl.enqueueHtml(suffixFor(early.data))
        ctrl.close()
      } catch (err) {
        ctrl.error(err)
      }
    })()
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  const ctrl = createRenderStream()
  const stream = ctrl.stream
  void (async () => {
    try {
      ctrl.enqueueHtml(prefix)
      await loadPromise
      const final = getLoadOutcome()
      if (final.kind === 'response') {
        ctrl.enqueueHtml(clientRedirectScript(final.response))
        ctrl.enqueueHtml(suffixFor(extra))
        ctrl.close()
        return
      }
      if (final.kind === 'throw') {
        await writeLoadFailureIntoStream(ctrl, options, matched, event.request, final.err)
        ctrl.enqueueHtml(suffixFor(extra))
        ctrl.close()
        return
      }
      if (final.kind !== 'data') {
        ctrl.error(new Error('load did not settle after await'))
        return
      }
      await buildWriters(final.data)(ctrl)
      await ctrl.waitPending()
      ctrl.enqueueHtml(suffixFor(final.data))
      ctrl.close()
    } catch (err) {
      ctrl.error(err)
    }
  })()

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

async function renderPageBodyBuffered(
  component: AvedonComponentModule,
  data: Record<string, unknown>,
  layouts: AvedonComponentModule[],
): Promise<string> {
  const ctrl = createRenderStream()
  let writeBody: (c: RenderStreamController) => Promise<void> = async (c) => {
    c.enqueueHtml('<div data-avedon-page>')
    await writeComponent(component, data, c)
    c.enqueueHtml('</div>')
  }
  for (const layout of layouts) {
    const inner = writeBody
    writeBody = async (c) => {
      await writeComponent(layout, { ...data, children: inner }, c)
    }
  }
  await writeBody(ctrl)
  await ctrl.waitPending()
  ctrl.close()
  return streamToString(ctrl.stream)
}

async function writeComponent(
  component: AvedonComponentModule,
  props: Record<string, unknown>,
  ctrl: RenderStreamController,
): Promise<void> {
  if (typeof component.renderInto === 'function') {
    await component.renderInto(ctrl, props)
    return
  }

  let propsForRender = props
  if (typeof props.children === 'function') {
    const childCtrl = createRenderStream()
    const htmlP = streamToString(childCtrl.stream)
    await (props.children as (c: RenderStreamController) => Promise<void>)(childCtrl)
    await childCtrl.waitPending()
    childCtrl.close()
    propsForRender = { ...props, children: await htmlP }
  }

  if (typeof component.renderToStream === 'function') {
    await ctrl.pipeChildren(component.renderToStream(propsForRender))
    return
  }
  ctrl.enqueueHtml(component.render(propsForRender))
}

function pickRouteComponent(
  matched: MatchResult | null,
  kind: 'error' | 'notFound',
  globalMod?: AvedonComponentModule,
): AvedonComponentModule | undefined {
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
    const body = `<div data-avedon-page>${c.render({ url: request.url })}</div>`
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
    const body = `<div data-avedon-page>${c.render({ status, message })}</div>`
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
export { assertCsrf } from './csrf.js'
export {
  renderShell,
  renderShellPrefix,
  renderShellSuffixFromTemplate,
  resolveComponent,
} from './ssr.js'
export { defineRoutes, route } from './types.js'
