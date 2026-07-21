import { describe, expect, it } from 'vitest'
import { assertCsrf } from './csrf.js'
import { isHttpError } from './errors.js'

describe('assertCsrf', () => {
  it('allows same-origin Origin', () => {
    expect(() =>
      assertCsrf(
        new Request('http://localhost/x?_action=a', {
          method: 'POST',
          headers: { origin: 'http://localhost' },
        }),
      ),
    ).not.toThrow()
  })

  it('rejects cross-origin Origin', () => {
    try {
      assertCsrf(
        new Request('http://localhost/x?_action=a', {
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }),
      )
      expect.unreachable()
    } catch (e) {
      expect(isHttpError(e) && e.status).toBe(403)
    }
  })

  it('allows matching Referer when Origin absent', () => {
    expect(() =>
      assertCsrf(
        new Request('http://localhost/x?_action=a', {
          method: 'POST',
          headers: { referer: 'http://localhost/posts/1' },
        }),
      ),
    ).not.toThrow()
  })

  it('rejects when Origin and Referer are missing', () => {
    try {
      assertCsrf(new Request('http://localhost/x?_action=a', { method: 'POST' }))
      expect.unreachable()
    } catch (e) {
      expect(isHttpError(e) && e.status).toBe(403)
    }
  })

  it('skips when csrf is false', () => {
    expect(() =>
      assertCsrf(new Request('http://localhost/x', { method: 'POST' }), false),
    ).not.toThrow()
  })

  it('allows trustedOrigins', () => {
    expect(() =>
      assertCsrf(
        new Request('http://localhost/x', {
          method: 'POST',
          headers: { origin: 'https://app.example' },
        }),
        { trustedOrigins: ['https://app.example'] },
      ),
    ).not.toThrow()
  })
})
