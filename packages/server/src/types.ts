import type {
  ActionHandler,
  AdapterBuilder,
  AdapterInterface,
  ApiHandler,
  ExtractParams,
  GuardFn,
  LoadContext,
  LoadResult,
  RenderMode,
} from '@vexjs/shared'

export type { RenderMode, ActionHandler, ApiHandler, GuardFn, LoadResult, AdapterInterface, AdapterBuilder, ExtractParams }

/** Alias used throughout the server package. */
export type LoadEvent = LoadContext

export interface VexComponentModule {
  render: (props?: Record<string, unknown>) => string
  mount?: (target: Element, props?: Record<string, unknown>) => { destroy(): void; update(p: Record<string, unknown>): void }
  css?: string
  cssHash?: string
  load?: (event: LoadEvent) => Promise<LoadResult> | LoadResult
  actions?: Record<string, ActionHandler>
  api?: Record<string, ApiHandler>
  api_GET?: ApiHandler
  api_POST?: ApiHandler
  api_PUT?: ApiHandler
  api_PATCH?: ApiHandler
  api_DELETE?: ApiHandler
  default?: VexComponentModule
}

export interface RouteConfig {
  path: string
  component: VexComponentModule | (() => Promise<VexComponentModule>)
  /** Default: 'ssr' */
  render?: RenderMode
  layout?: VexComponentModule | (() => Promise<VexComponentModule>)
  children?: Routes
  /** Preferred guard name (spec). */
  guard?: GuardFn
  /** @deprecated Prefer `guard`. */
  canActivate?: GuardFn
  canMatch?: GuardFn
  /** SSG path list (or getStaticPaths-style). */
  entries?: () => Promise<string[]> | string[]
  getStaticPaths?: () => Promise<string[]> | string[]
  error?: VexComponentModule
  notFound?: VexComponentModule
}

export type Routes = RouteConfig[]

export function defineRoutes(routes: Routes): Routes {
  return routes
}

export interface HandleArgs {
  request: Request
  resolve: (request: Request) => Promise<Response>
}

export type HandleHook = (args: HandleArgs) => Promise<Response> | Response

export interface HandlerOptions {
  routes: Routes
  appHtml: string
  hooks?: { handle?: HandleHook }
  errorComponent?: VexComponentModule
  notFoundComponent?: VexComponentModule
  clientEntry?: string
  getCss?: () => string
}
