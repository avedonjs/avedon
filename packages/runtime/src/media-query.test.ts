import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, mediaQuery } from './index.js'

describe('mediaQuery', () => {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  let matches = false

  afterEach(() => {
    listeners.clear()
    matches = false
    vi.unstubAllGlobals()
  })

  function stubMatchMedia() {
    vi.stubGlobal('matchMedia', (query: string) => {
      expect(query).toBe('(max-width: 600px)')
      return {
        get matches() {
          return matches
        },
        media: query,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.add(cb)
        },
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.delete(cb)
        },
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
    })
  }

  it('tracks matchMedia and cleans up with lifecycle', () => {
    stubMatchMedia()
    matches = true
    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const mq = mediaQuery('(max-width: 600px)')
    __lifecycleEnd()
    expect(mq.get()).toBe(true)
    expect(() => mq.set(false)).toThrow(/read-only/)

    matches = false
    for (const cb of listeners) cb({ matches: false })
    expect(mq.get()).toBe(false)
    expect(listeners.size).toBe(1)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const mq = mediaQuery('(min-width: 1px)')
    expect(mq.get()).toBe(false)
  })
})
