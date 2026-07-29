import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, storageEstimateSignal } from './index.js'

describe('storageEstimateSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves navigator.storage.estimate and cleans up', async () => {
    const listeners = new Map<string, Set<() => void>>()
    const estimate = vi.fn(async () => ({ usage: 10, quota: 100 }))
    vi.stubGlobal('navigator', { storage: { estimate } })
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
    const est = storageEstimateSignal()
    __lifecycleEnd()
    expect(est.get()).toBe(null)
    await vi.waitFor(() => {
      expect(est.get()).toEqual({ usage: 10, quota: 100 })
    })

    estimate.mockResolvedValueOnce({ usage: 20, quota: 200 })
    for (const cb of listeners.get('focus') ?? []) cb()
    await vi.waitFor(() => {
      expect(est.get()).toEqual({ usage: 20, quota: 200 })
    })

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
  })

  it('stays null without storage.estimate', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', undefined)
    expect(storageEstimateSignal().get()).toBe(null)
  })
})
