import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, prefersContrast } from './index.js'

describe('prefersContrast', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks prefers-contrast: more via matchMedia', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>()
    let matches = false
    vi.stubGlobal('matchMedia', (query: string) => {
      expect(query).toBe('(prefers-contrast: more)')
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
    const contrast = prefersContrast()
    __lifecycleEnd()
    expect(contrast.get()).toBe(false)

    matches = true
    for (const cb of listeners) cb({ matches: true })
    expect(contrast.get()).toBe(true)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })
})
