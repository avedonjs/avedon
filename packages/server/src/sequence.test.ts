import { describe, expect, it } from 'vitest'
import { sequence } from './sequence.js'
import type { Middleware } from './types.js'

describe('sequence', () => {
  it('runs handlers outer to inner', async () => {
    const order: string[] = []
    const a: Middleware = async ({ request, resolve }) => {
      order.push('a-in')
      const res = await resolve(request)
      order.push('a-out')
      return res
    }
    const b: Middleware = async ({ request, resolve }) => {
      order.push('b-in')
      const res = await resolve(request)
      order.push('b-out')
      return res
    }
    const core = async () => {
      order.push('core')
      return new Response('ok')
    }
    const handler = sequence(a, b)
    const res = await handler({ request: new Request('http://localhost/'), resolve: core })
    expect(await res.text()).toBe('ok')
    expect(order).toEqual(['a-in', 'b-in', 'core', 'b-out', 'a-out'])
  })

  it('skips inner handlers when outer returns early', async () => {
    const order: string[] = []
    const a: Middleware = async () => {
      order.push('a')
      return new Response('blocked', { status: 429 })
    }
    const b: Middleware = async ({ request, resolve }) => {
      order.push('b')
      return resolve(request)
    }
    const core = async () => {
      order.push('core')
      return new Response('ok')
    }
    const handler = sequence(a, b)
    const res = await handler({ request: new Request('http://localhost/'), resolve: core })
    expect(res.status).toBe(429)
    expect(order).toEqual(['a'])
  })

  it('allows post-resolve response mutation', async () => {
    const mw: Middleware = async ({ request, resolve }) => {
      const res = await resolve(request)
      const headers = new Headers(res.headers)
      headers.set('x-mw', '1')
      return new Response(res.body, { status: res.status, headers })
    }
    const core = async () => new Response('ok')
    const handler = sequence(mw)
    const res = await handler({ request: new Request('http://localhost/'), resolve: core })
    expect(res.headers.get('x-mw')).toBe('1')
    expect(await res.text()).toBe('ok')
  })

  it('with no handlers, calls resolve directly', async () => {
    const handler = sequence()
    const res = await handler({
      request: new Request('http://localhost/'),
      resolve: async () => new Response('direct'),
    })
    expect(await res.text()).toBe('direct')
  })
})
