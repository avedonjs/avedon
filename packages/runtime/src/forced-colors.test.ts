import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, forcedColors } from './index.js'

describe('forcedColors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks forced-colors: active via matchMedia', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>()
    let matches = false
    vi.stubGlobal('matchMedia', (query: string) => {
      expect(query).toBe('(forced-colors: active)')
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

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const forced = forcedColors()
    __lifecycleEnd()
    expect(forced.get()).toBe(false)

    matches = true
    for (const cb of listeners) cb({ matches: true })
    expect(forced.get()).toBe(true)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })
})
