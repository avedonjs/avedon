import type { CookieSerializeOptions, GuardFn, Session } from '@vexjs/shared'
import type { LoadEvent } from './types.js'
import { assertCookieValueSize, attachCookies, createCookies, type CookiesBag } from './cookies.js'
import { redirect } from './errors.js'
import { sealPayload, unsealPayload } from './seal.js'
import type { SessionOptions } from './types.js'

export const DEFAULT_SESSION_NAME = 'vex_session'
export const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 24 * 7

export function validateSessionOptions(session: SessionOptions | undefined): void {
  if (!session) return
  if (!session.secret || session.secret.length < 32) {
    throw new Error('HandlerOptions.session.secret must be at least 32 characters')
  }
}

export async function createSession(
  cookies: CookiesBag,
  url: URL,
  options: SessionOptions,
): Promise<Session> {
  const name = options.name ?? DEFAULT_SESSION_NAME
  const maxAge = options.maxAge ?? DEFAULT_SESSION_MAX_AGE
  const cookieDefaults = options.cookie ?? {}

  const raw = cookies.get(name)
  let data: Record<string, unknown> | null = raw
    ? await unsealPayload(raw, options.secret)
    : null

  const session: Session = {
    get data() {
      return data
    },
    set(next: Record<string, unknown>) {
      data = next
      cookies.pending.push(
        (async () => {
          const sealed = await sealPayload(next, options.secret, maxAge)
          assertCookieValueSize(sealed)
          cookies.set(name, sealed, {
            maxAge,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: url.protocol === 'https:',
            ...cookieDefaults,
          })
        })(),
      )
    },
    destroy() {
      data = null
      cookies.delete(name, {
        path: cookieDefaults.path ?? '/',
        httpOnly: cookieDefaults.httpOnly ?? true,
        sameSite: cookieDefaults.sameSite ?? 'lax',
        secure: cookieDefaults.secure ?? url.protocol === 'https:',
        ...cookieDefaults,
      })
    },
  }

  return session
}

export function requireSession(opts?: { redirectTo?: string }): GuardFn {
  return (event) => {
    if (!('cookies' in event)) return true

    const deny = () => {
      if (opts?.redirectTo) return redirect(opts.redirectTo)
      return false
    }

    if (!event.session) return deny()
    if (event.session.data == null) return deny()
    return true
  }
}

export async function buildRequestContext(
  request: Request,
  url: URL,
  params: Record<string, string>,
  sessionOptions?: SessionOptions,
): Promise<{ event: LoadEvent; finalize: (response: Response) => Promise<Response> }> {
  const cookies = createCookies(request, url)
  let session: Session | undefined
  if (sessionOptions) {
    session = await createSession(cookies, url, sessionOptions)
  }
  const event: LoadEvent = {
    params,
    request,
    url,
    cookies,
    ...(session ? { session } : {}),
  }
  return {
    event,
    finalize: (response) => attachCookies(response, cookies),
  }
}
