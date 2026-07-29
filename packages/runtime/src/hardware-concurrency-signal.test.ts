import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, hardwareConcurrencySignal } from './index.js'

describe('hardwareConcurrencySignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.hardwareConcurrency and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let cores = 4
    vi.stubGlobal('navigator', {
      get hardwareConcurrency() {
        return cores
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
    const coresSig = hardwareConcurrencySignal()
    __lifecycleEnd()
    expect(coresSig.get()).toBe(4)

    cores = 8
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(coresSig.get()).toBe(8)

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to 0 without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(hardwareConcurrencySignal().get()).toBe(0)
  })
})
