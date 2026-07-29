import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, maxTouchPointsSignal } from './index.js'

describe('maxTouchPointsSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.maxTouchPoints and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let points = 0
    vi.stubGlobal('navigator', {
      get maxTouchPoints() {
        return points
      },
    })
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const touch = maxTouchPointsSignal()
    __lifecycleEnd()
    expect(touch.get()).toBe(0)

    points = 5
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(touch.get()).toBe(5)

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to 0 without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(maxTouchPointsSignal().get()).toBe(0)
  })
})
