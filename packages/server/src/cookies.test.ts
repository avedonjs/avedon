import { describe, expect, it } from 'vitest'
import { createCookies, parseCookieHeader, serializeSetCookie } from './cookies.js'

describe('parseCookieHeader', () => {
  it('parses multiple cookies', () => {
    const map = parseCookieHeader('a=1; b=hello%20world')
    expect(map.get('a')).toBe('1')
    expect(map.get('b')).toBe('hello world')
  })
})

describe('createCookies', () => {
  it('sets and serializes Set-Cookie on finalize path', () => {
    const url = new URL('http://localhost/')
    const cookies = createCookies(new Request(url), url)
    cookies.set('theme', 'dark', { maxAge: 60 })
    const lines = cookies.getSetCookieHeaders()
    expect(lines[0]).toContain('theme=dark')
    expect(lines[0]).toContain('Max-Age=60')
    expect(lines[0]).toContain('HttpOnly')
  })

  it('delete clears cookie', () => {
    const url = new URL('http://localhost/')
    const cookies = createCookies(new Request(url), url)
    cookies.delete('sid')
    expect(cookies.getSetCookieHeaders()[0]).toContain('Max-Age=0')
  })
})

describe('serializeSetCookie', () => {
  it('rejects oversized values', () => {
    expect(() => serializeSetCookie('n', 'x'.repeat(5000))).toThrow(/4096/)
  })
})
