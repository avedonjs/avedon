import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, prefersColorScheme } from './index.js'

describe('prefersColorScheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks prefers-color-scheme via matchMedia', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>()
    let matches = false
    vi.stubGlobal('matchMedia', (query: string) => {
      expect(query).toBe('(prefers-color-scheme: dark)')
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
    const scheme = prefersColorScheme()
    __lifecycleEnd()
    expect(scheme.get()).toBe('light')

    matches = true
    for (const cb of listeners) cb({ matches: true })
    expect(scheme.get()).toBe('dark')

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('rejects writes', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList)

    const scheme = prefersColorScheme()
    expect(() => scheme.set('dark')).toThrow(/read-only/)
    expect(() => scheme.update(() => 'dark')).toThrow(/read-only/)
  })
})
