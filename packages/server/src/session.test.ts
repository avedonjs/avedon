import { describe, expect, it } from 'vitest'
import { createCookies } from './cookies.js'
import { sealPayload, unsealPayload } from './seal.js'
import {
  createSession,
  requireSession,
  validateSessionOptions,
  DEFAULT_SESSION_NAME,
} from './session.js'
import { createHandler } from './pipeline.js'

const secret = 'test-secret-at-least-32-characters-long'

describe('validateSessionOptions', () => {
  it('throws on short secret', () => {
    expect(() => validateSessionOptions({ secret: 'short' })).toThrow(/32/)
  })
})

describe('seal/unseal', () => {
  it('round-trips payload', async () => {
    const token = await sealPayload({ userId: '7' }, secret, 3600)
    expect(await unsealPayload(token, secret)).toEqual({ userId: '7' })
  })

  it('returns null when tampered', async () => {
    const token = await sealPayload({ ok: true }, secret)
    expect(await unsealPayload(token + 'x', secret)).toBeNull()
  })

  it('returns null when expired', async () => {
    const token = await sealPayload({ ok: true }, secret, -10)
    expect(await unsealPayload(token, secret)).toBeNull()
  })
})

describe('createSession', () => {
  it('reads sealed cookie from request', async () => {
    const url = new URL('http://localhost/')
    const sealed = await sealPayload({ role: 'admin' }, secret, 3600)
    const request = new Request(url, {
      headers: { cookie: `${DEFAULT_SESSION_NAME}=${encodeURIComponent(sealed)}` },
    })
    const cookies = createCookies(request, url)
    const session = await createSession(cookies, url, { secret })
    expect(session.data).toEqual({ role: 'admin' })
  })
})

describe('requireSession + pipeline', () => {
  const appHtml = '<!doctype html><html><body><div id="app"></div></body></html>'

  it('rejects without session', async () => {
    const handler = createHandler({
      appHtml,
      session: { secret },
      routes: [
        {
          path: '/admin',
          guard: requireSession(),
          component: { render: () => 'admin' },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/admin'))
    expect(res.status).toBe(403)
  })

  it('allows with valid session cookie', async () => {
    const handler = createHandler({
      appHtml,
      session: { secret },
      routes: [
        {
          path: '/admin',
          guard: requireSession(),
          component: { render: () => 'admin' },
        },
      ],
    })
    const url = new URL('http://localhost/admin')
    const cookies = createCookies(new Request(url), url)
    const session = await createSession(cookies, url, { secret })
    session.set({ userId: '1' })
    await Promise.all(cookies.pending)
    const setCookie = cookies.getSetCookieHeaders()[0]
    const res = await handler(
      new Request(url, { headers: { cookie: setCookie.split(';')[0] } }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('admin')
  })

  it('action set persists Set-Cookie', async () => {
    const handler = createHandler({
      appHtml,
      session: { secret },
      routes: [
        {
          path: '/',
          component: {
            render: () => 'ok',
            actions: {
              login: async ({ session }) => {
                session!.set({ userId: '42' })
                return {}
              },
            },
          },
        },
      ],
    })
    const res = await handler(
      new Request('http://localhost/?/login', {
        method: 'POST',
        headers: { origin: 'http://localhost' },
        body: new URLSearchParams(),
      }),
    )
    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie?.() ?? []
    expect(setCookies.some((c) => c.startsWith(`${DEFAULT_SESSION_NAME}=`))).toBe(true)
  })

  it('createHandler throws on bad secret', () => {
    expect(() =>
      createHandler({
        appHtml,
        session: { secret: 'tiny' },
        routes: [{ path: '/', component: { render: () => '' } }],
      }),
    ).toThrow(/32/)
  })
})
