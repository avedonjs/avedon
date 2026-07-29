import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, pageScroll } from './index.js'

describe('pageScroll', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks scrollX/scrollY and cleans up with lifecycle', () => {
    const listeners = new Set<() => void>()
    let scrollX = 0
    let scrollY = 40
    vi.stubGlobal('window', {
      get scrollX() {
        return scrollX
      },
      get scrollY() {
        return scrollY
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
    const scroll = pageScroll()
    __lifecycleEnd()
    expect(scroll.get()).toEqual({ x: 0, y: 40 })
    expect(() => scroll.set({ x: 1, y: 1 })).toThrow(/read-only/)
    expect(String(scroll)).toBe('0,40')

    scrollX = 12
    scrollY = 200
    for (const cb of listeners) cb()
    expect(scroll.get()).toEqual({ x: 12, y: 200 })
    expect(listeners.size).toBe(1)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to 0,0 when window is unavailable', () => {
    vi.stubGlobal('window', undefined)
    const scroll = pageScroll()
    expect(scroll.get()).toEqual({ x: 0, y: 0 })
  })
})
