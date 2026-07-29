import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, devicePixelRatio } from './index.js'

describe('devicePixelRatio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks window.devicePixelRatio and cleans up with lifecycle', () => {
    const listeners = new Set<() => void>()
    let dpr = 1
    vi.stubGlobal('window', {
      get devicePixelRatio() {
        return dpr
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
    const ratio = devicePixelRatio()
    __lifecycleEnd()
    expect(ratio.get()).toBe(1)
    expect(() => ratio.set(2)).toThrow(/read-only/)

    dpr = 2
    for (const cb of listeners) cb()
    expect(ratio.get()).toBe(2)
    expect(listeners.size).toBe(1)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to 1 when window is unavailable', () => {
    vi.stubGlobal('window', undefined)
    expect(devicePixelRatio().get()).toBe(1)
  })
})
