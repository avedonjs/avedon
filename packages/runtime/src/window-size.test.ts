import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, windowSize } from './index.js'

describe('windowSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks innerWidth/innerHeight and cleans up with lifecycle', () => {
    const listeners = new Set<() => void>()
    let innerWidth = 800
    let innerHeight = 600
    vi.stubGlobal('window', {
      get innerWidth() {
        return innerWidth
      },
      get innerHeight() {
        return innerHeight
      },
      addEventListener: (_: string, cb: () => void) => {
        listeners.add(cb)
      },
      removeEventListener: (_: string, cb: () => void) => {
        listeners.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const size = windowSize()
    __lifecycleEnd()
    expect(size.get()).toEqual({ width: 800, height: 600 })
    expect(() => size.set({ width: 1, height: 1 })).toThrow(/read-only/)
    expect(String(size)).toBe('800x600')

    innerWidth = 1024
    innerHeight = 768
    for (const cb of listeners) cb()
    expect(size.get()).toEqual({ width: 1024, height: 768 })
    expect(listeners.size).toBe(1)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to 0x0 when window is unavailable', () => {
    vi.stubGlobal('window', undefined)
    const size = windowSize()
    expect(size.get()).toEqual({ width: 0, height: 0 })
  })
})
