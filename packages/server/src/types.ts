import type {
  ActionHandler,
  AdapterBuilder,
  AdapterInterface,
  ApiHandler,
  CookieSerializeOptions,
  Cookies,
  ExtractParams,
  GuardFn,
  JoinPaths,
  LoadContext,
  LoadEvent,
  LoadResult,
  MergeParams,
  ParamsRecord,
  RenderMode,
  Session,
} from '@avedon/shared'

export type {
  RenderMode,
  ActionHandler,
  ApiHandler,
  GuardFn,
  LoadResult,
  AdapterInterface,
  AdapterBuilder,
  ExtractParams,
  JoinPaths,
  MergeParams,
  LoadContext,
  LoadEvent,
  ParamsRecord,
  Cookies,
  Session,
  CookieSerializeOptions,
}

export interface AvedonComponentModule<Params extends ParamsRecord = Record<string, string>> {
  render: (props?: Record<string, unknown>) => string
  renderInto?: (
    ctrl: import('@avedon/runtime').RenderStreamController,
    props?: Record<string, unknown>,
  ) => Promise<void>
  renderToStream?: (props?: Record<string, unknown>) => ReadableStream<Uint8Array>
  mount?: (
    target: Element,
    props?: Record<string, unknown>,
  ) => { destroy(): void; update(p: Record<string, unknown>): void }
  css?: string
  cssHash?: string
  load?: (event: LoadContext<Params>) => Promise<LoadResult> | LoadResult
  actions?: Record<string, ActionHandler<Params>>
  api?: Record<string, ApiHandler<Params>>
  api_GET?: ApiHandler<Params>
  api_POST?: ApiHandler<Params>
  api_PUT?: ApiHandler<Params>
  api_PATCH?: ApiHandler<Params>
  api_DELETE?: ApiHandler<Params>
  default?: AvedonComponentModule<Params>
}

type ComponentRef<Params extends ParamsRecord> =
  | AvedonComponentModule<Params>
  | (() => Promise<AvedonComponentModule<Params>>)

/** Runtime route shape (matcher / pipeline). */
export interface RouteConfig {
  path: string
  component: ComponentRef<Record<string, string>>
  render?: RenderMode
  layout?: ComponentRef<Record<string, string>>
  children?: Routes
  guard?: GuardFn
  canActivate?: GuardFn
  canMatch?: GuardFn
  entries?: () => Promise<string[]> | string[]
  getStaticPaths?: () => Promise<string[]> | string[]
  /**
   * ISR: regenerate this SSG page every N seconds (stale-while-revalidate).
   * Omit for immutable static HTML. `0` regenerates on every request (deduped).
   * Only meaningful with `render: 'ssg'`.
   */
  revalidate?: number
  /**
   * SSR opt-out: wait for `load()` and the full document body before sending bytes
   * (no streaming). Use when `<head>` depends on `load`, or redirects/errors must
   * stay HTTP-level without a shell-first race.
   */
  bufferHtml?: boolean
  error?: AvedonComponentModule
  notFound?: AvedonComponentModule
}

export type Routes = RouteConfig[]

export interface HandleArgs {
  request: Request
  resolve: (request: Request) => Promise<Response>
}

export type HandleHook = (args: HandleArgs) => Promise<Response> | Response

/** Route-agnostic middleware; same shape as `HandleHook`. */
export type Middleware = HandleHook

/** `false` disables checks; otherwise Origin/Referer must match request origin (plus allowlist). */
export type CsrfOptions = false | { trustedOrigins?: string[] }

export interface HandlerOptions {
  routes: Routes
  appHtml: string
  hooks?: { handle?: HandleHook; middleware?: Middleware[] }
  errorComponent?: AvedonComponentModule
  notFoundComponent?: AvedonComponentModule
  clientEntry?: string
  getCss?: () => string
  /** CSRF for form `actions` (default: Origin/Referer check). Set `false` to disable. */
  csrf?: CsrfOptions
  /** Sealed session cookie (Web Crypto). Requires `secret` (32+ chars). */
  session?: SessionOptions
}

export type SessionOptions = {
  secret: string
  name?: string
  maxAge?: number
  cookie?: CookieSerializeOptions
}

type RouteRest<Params extends ParamsRecord> = {
  component: ComponentRef<Params>
  render?: RenderMode
  layout?: ComponentRef<Params>
  guard?: GuardFn<Params>
  canActivate?: GuardFn<Params>
  canMatch?: GuardFn<Params>
  entries?: () => Promise<string[]> | string[]
  getStaticPaths?: () => Promise<string[]> | string[]
  /** ISR interval in seconds for `render: 'ssg'` (see RouteConfig.revalidate). */
  revalidate?: number
  error?: AvedonComponentModule
  notFound?: AvedonComponentModule
  /**
   * Nested routes. Prefer `children: (r) => [r('child', { ... })]` so child
   * guards inherit parent params via ExtractParams merge.
   */
  children?: Routes | ((r: ChildRouteFactory<Params>) => Routes)
}

export type ChildRouteFactory<ParentParams extends ParamsRecord> = <const P extends string>(
  path: P,
  config: RouteRest<MergeParams<ParentParams, ExtractParams<P>>>,
) => RouteConfig & { path: P }

/**
 * Build a typed route. Path is a separate argument so TypeScript can infer
 * `params` for `guard` / component load contexts (`ExtractParams<P>`).
 *
 * @example
 * route('/posts/:id', {
 *   component: Post,
 *   guard: (e) => e.params.id.length > 0,
 * })
 */
export function route<const P extends string, ParentParams extends ParamsRecord = {}>(
  path: P,
  config: RouteRest<MergeParams<ParentParams, ExtractParams<P>>>,
): RouteConfig & { path: P } {
  type Params = MergeParams<ParentParams, ExtractParams<P>>
  const childFactory = ((childPath: string, childConfig: RouteRest<any>) =>
    route(childPath, childConfig)) as ChildRouteFactory<Params>

  const { children, ...rest } = config
  const resolved: Routes | undefined =
    typeof children === 'function' ? children(childFactory) : children

  return {
    path,
    ...rest,
    ...(resolved ? { children: resolved } : {}),
  } as RouteConfig & { path: P }
}

/** Full path type for a parent/child pair (for tests / docs). */
export type NestedPath<Parent extends string, Child extends string> = JoinPaths<Parent, Child>

/**
 * Define a route table. Prefer `route('/path/:id', { ... })` entries so guards
 * get typed `params`. Plain `{ path, component }` objects remain valid at runtime.
 */
export function defineRoutes<const T extends readonly RouteConfig[]>(routes: T): T {
  return routes
}
