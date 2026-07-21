import type { CookieSerializeOptions, Cookies } from '@avedon/shared'

const MAX_COOKIE_VALUE_BYTES = 4096

type OutboundCookie = { name: string; value: string; opts?: CookieSerializeOptions }

export function parseCookieHeader(header: string | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!header) return map
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const name = trimmed.slice(0, eq).trim()
    const raw = trimmed.slice(eq + 1).trim()
    try {
      map.set(name, decodeURIComponent(raw))
    } catch {
      map.set(name, raw)
    }
  }
  return map
}

export function serializeSetCookie(name: string, value: string, opts: CookieSerializeOptions = {}): string {
  assertCookieValueSize(value)
  let out = `${name}=${encodeCookieValue(value)}`
  if (opts.maxAge !== undefined) out += `; Max-Age=${opts.maxAge}`
  if (opts.expires) out += `; Expires=${opts.expires.toUTCString()}`
  if (opts.domain) out += `; Domain=${opts.domain}`
  if (opts.path) out += `; Path=${opts.path}`
  if (opts.httpOnly) out += '; HttpOnly'
  if (opts.secure) out += '; Secure'
  if (opts.sameSite) {
    const s = opts.sameSite === 'none' ? 'None' : opts.sameSite === 'strict' ? 'Strict' : 'Lax'
    out += `; SameSite=${s}`
  }
  return out
}

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function assertCookieValueSize(value: string): void {
  const bytes = new TextEncoder().encode(value).byteLength
  if (bytes > MAX_COOKIE_VALUE_BYTES) {
    throw new Error(`Cookie value exceeds ${MAX_COOKIE_VALUE_BYTES} bytes`)
  }
}

export type CookiesBag = Cookies & {
  /** Pending async work (e.g. session seal) before attaching Set-Cookie. */
  pending: Promise<void>[]
  getSetCookieHeaders(): string[]
}

export function createCookies(request: Request, url: URL): CookiesBag {
  const inbound = parseCookieHeader(request.headers.get('cookie'))
  const outbound: OutboundCookie[] = []

  const bag: CookiesBag = {
    pending: [],
    get(name: string) {
      return inbound.get(name)
    },
    getAll() {
      return Object.fromEntries(inbound.entries())
    },
    set(name: string, value: string, opts: CookieSerializeOptions = {}) {
      assertCookieValueSize(value)
      outbound.push({ name, value, opts })
    },
    delete(name: string, opts: CookieSerializeOptions = {}) {
      outbound.push({
        name,
        value: '',
        opts: { ...opts, maxAge: 0, expires: new Date(0) },
      })
    },
    getSetCookieHeaders() {
      const secureDefault = url.protocol === 'https:'
      return outbound.map(({ name, value, opts = {} }) =>
        serializeSetCookie(name, value, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: secureDefault,
          ...opts,
        }),
      )
    },
  }

  return bag
}

export async function attachCookies(response: Response, cookies: CookiesBag): Promise<Response> {
  await Promise.all(cookies.pending)
  const lines = cookies.getSetCookieHeaders()
  if (lines.length === 0) return response

  const headers = new Headers(response.headers)
  for (const line of lines) {
    headers.append('set-cookie', line)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
