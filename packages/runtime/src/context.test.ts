import { describe, expect, it } from 'vitest'
import { __contextBegin, getAllContexts, getContext, hasContext, setContext } from './index.js'

describe('context', () => {
  it('setContext / getContext within a frame', () => {
    const end = __contextBegin()
    setContext('theme', 'dark')
    expect(getContext('theme')).toBe('dark')
    expect(hasContext('theme')).toBe(true)
    expect(hasContext('missing')).toBe(false)
    end()
  })

  it('child frames inherit ancestor values', () => {
    const endParent = __contextBegin()
    setContext('theme', 'dark')
    const endChild = __contextBegin()
    expect(getContext('theme')).toBe('dark')
    setContext('theme', 'light')
    expect(getContext('theme')).toBe('light')
    endChild()
    expect(getContext('theme')).toBe('dark')
    endParent()
  })

  it('getAllContexts merges ancestors with child overrides', () => {
    const endParent = __contextBegin()
    setContext('theme', 'dark')
    setContext('locale', 'en')
    const endChild = __contextBegin()
    setContext('theme', 'light')
    const all = getAllContexts()
    expect(all.get('theme')).toBe('light')
    expect(all.get('locale')).toBe('en')
    expect(all.size).toBe(2)
    endChild()
    endParent()
  })

  it('throws outside initialization', () => {
    expect(() => setContext('x', 1)).toThrow(/initialization/)
    expect(() => getContext('x')).toThrow(/not found/)
    expect(() => getAllContexts()).toThrow(/initialization/)
  })
})
