import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, deviceMemorySignal } from './index.js'

describe('deviceMemorySignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.deviceMemory and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let mem = 4
    vi.stubGlobal('navigator', {
      get deviceMemory() {
        return mem
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
    const memSig = deviceMemorySignal()
    __lifecycleEnd()
    expect(memSig.get()).toBe(4)

    mem = 8
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(memSig.get()).toBe(8)

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to 0 without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(deviceMemorySignal().get()).toBe(0)
  })
})
