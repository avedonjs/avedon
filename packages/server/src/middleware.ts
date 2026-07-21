import type { Middleware } from './types.js'

export type CorsOrigin =
  | true
  | string
  | string[]
  | RegExp
  | ((origin: string) => boolean)

export interface CorsOptions {
  origin?: CorsOrigin
  methods?: string[]
  headers?: string[]
  maxAge?: number
}

export interface LoggerOptions {
  format?: 'dev' | 'short'
}

export interface RateLimitOptions {
  windowMs?: number
  max?: number
  key?: (req: Request) => string
}

function resolveAllowOrigin(originOpt: CorsOrigin | undefined, requestOrigin: string | null): string | null {
  if (originOpt === undefined || originOpt === true) {
    return requestOrigin
  }
  if (typeof originOpt === 'string') {
    if (originOpt === '*') return '*'
    if (!requestOrigin) return null
    return originOpt === requestOrigin ? requestOrigin : null
  }
  if (Array.isArray(originOpt)) {
    if (!requestOrigin) return null
    return originOpt.includes(requestOrigin) ? requestOrigin : null
  }
  if (originOpt instanceof RegExp) {
    if (!requestOrigin) return null
    return originOpt.test(requestOrigin) ? requestOrigin : null
  }
  if (!requestOrigin) return null
  return originOpt(requestOrigin) ? requestOrigin : null
}

function applyCorsHeaders(
  headers: Headers,
  allowOrigin: string | null,
  opts: CorsOptions,
): void {
  if (allowOrigin) headers.set('Access-Control-Allow-Origin', allowOrigin)
  const methods = opts.methods ?? ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
  headers.set('Access-Control-Allow-Methods', methods.join(', '))
  if (opts.headers?.length) {
    headers.set('Access-Control-Allow-Headers', opts.headers.join(', '))
  } else {
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  if (opts.maxAge != null) {
    headers.set('Access-Control-Max-Age', String(opts.maxAge))
  }
  if (allowOrigin && allowOrigin !== '*') {
    headers.set('Vary', 'Origin')
  }
}

/** Attach CORS headers; answer OPTIONS with 204 without calling resolve. */
export function cors(opts: CorsOptions = {}): Middleware {
  return async ({ request, resolve }) => {
    const requestOrigin = request.headers.get('origin')
    const allowOrigin = resolveAllowOrigin(opts.origin ?? true, requestOrigin)

    if (request.method.toUpperCase() === 'OPTIONS') {
      const headers = new Headers()
      applyCorsHeaders(headers, allowOrigin, opts)
      return new Response(null, { status: 204, headers })
    }

    const res = await resolve(request)
    const headers = new Headers(res.headers)
    applyCorsHeaders(headers, allowOrigin, opts)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}

/** Log method, path, status, and duration via console. */
export function logger(opts: LoggerOptions = {}): Middleware {
  const format = opts.format ?? 'dev'
  return async ({ request, resolve }) => {
    const start = Date.now()
    const url = new URL(request.url)
    const res = await resolve(request)
    const ms = Date.now() - start
    const line =
      format === 'short'
        ? `${request.method} ${url.pathname} ${res.status}`
        : `${request.method} ${url.pathname} ${res.status} ${ms}ms`
    console.log(line)
    return res
  }
}

function defaultRateLimitKey(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return 'anon'
}

/**
 * Process-local fixed-window rate limiter.
 * Not suitable for multi-instance production without a shared store.
 */
export function rateLimit(opts: RateLimitOptions = {}): Middleware {
  const windowMs = opts.windowMs ?? 60_000
  const max = opts.max ?? 100
  const keyFn = opts.key ?? defaultRateLimitKey
  const hits = new Map<string, { count: number; resetAt: number }>()

  return async ({ request, resolve }) => {
    const key = keyFn(request)
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }
    return resolve(request)
  }
}
