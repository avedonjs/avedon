import { describe, expect, it } from 'vitest'
import { evaluateCanActivate } from './index.js'

describe('evaluateCanActivate', () => {
  const event = {
    params: {},
    url: new URL('http://localhost/admin'),
  }

  it('allows when no guard', async () => {
    expect(await evaluateCanActivate(undefined, event)).toEqual({ type: 'allow' })
  })

  it('denies when guard returns false', async () => {
    expect(await evaluateCanActivate(() => false, event)).toEqual({
      type: 'deny',
      status: 403,
      message: 'Forbidden',
    })
  })

  it('denies when guard returns a Response', async () => {
    expect(
      await evaluateCanActivate(() => new Response('nope', { status: 401, statusText: 'Unauthorized' }), event),
    ).toEqual({
      type: 'deny',
      status: 401,
      message: 'Unauthorized',
    })
  })

  it('allows when guard returns true', async () => {
    expect(await evaluateCanActivate(() => true, event)).toEqual({ type: 'allow' })
  })
})
