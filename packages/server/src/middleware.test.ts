import { afterEach, describe, expect, it, vi } from 'vitest'
import { cors, logger, rateLimit } from './middleware.js'

describe('cors', () => {
  it('answers OPTIONS with 204 and CORS headers', async () => {
    const mw = cors({ origin: true, methods: ['GET', 'POST'], maxAge: 600 })
    let coreRan = false
    const res = await mw({
      request: new Request('http://localhost/api', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.example' },
      }),
      resolve: async () => {
        coreRan = true
        return new Response('nope')
      },
    })
    expect(coreRan).toBe(false)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Max-Age')).toBe('600')
  })

  it('attaches CORS headers on normal responses', async () => {
    const mw = cors({ origin: 'https://app.example' })
    const res = await mw({
      request: new Request('http://localhost/', {
        headers: { origin: 'https://app.example' },
      }),
      resolve: async () => new Response('ok'),
    })
    expect(await res.text()).toBe('ok')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example')
  })

  it('rejects disallowed origin', async () => {
    const mw = cors({ origin: ['https://allowed.example'] })
    const res = await mw({
      request: new Request('http://localhost/', {
        headers: { origin: 'https://evil.example' },
      }),
      resolve: async () => new Response('ok'),
    })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs method path status and duration', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mw = logger()
    await mw({
      request: new Request('http://localhost/hello'),
      resolve: async () => new Response('ok', { status: 201 }),
    })
    expect(spy).toHaveBeenCalledOnce()
    const line = String(spy.mock.calls[0]![0])
    expect(line).toMatch(/^GET \/hello 201 \d+ms$/)
  })

  it('supports short format', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mw = logger({ format: 'short' })
    await mw({
      request: new Request('http://localhost/x'),
      resolve: async () => new Response('ok'),
    })
    expect(String(spy.mock.calls[0]![0])).toBe('GET /x 200')
  })
})

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    const mw = rateLimit({ max: 2, windowMs: 60_000, key: () => 't1' })
    const res = await mw({
      request: new Request('http://localhost/'),
      resolve: async () => new Response('ok'),
    })
    expect(res.status).toBe(200)
  })

  it('returns 429 with Retry-After when exceeded', async () => {
    const mw = rateLimit({ max: 1, windowMs: 60_000, key: () => 't2' })
    await mw({
      request: new Request('http://localhost/'),
      resolve: async () => new Response('ok'),
    })
    const res = await mw({
      request: new Request('http://localhost/'),
      resolve: async () => new Response('ok'),
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('uses cf-connecting-ip then x-forwarded-for for default key', async () => {
    const mw = rateLimit({ max: 1, windowMs: 60_000 })
    await mw({
      request: new Request('http://localhost/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      }),
      resolve: async () => new Response('ok'),
    })
    const blocked = await mw({
      request: new Request('http://localhost/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      }),
      resolve: async () => new Response('ok'),
    })
    expect(blocked.status).toBe(429)

    const other = await mw({
      request: new Request('http://localhost/', {
        headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' },
      }),
      resolve: async () => new Response('ok'),
    })
    expect(other.status).toBe(200)
  })
})
