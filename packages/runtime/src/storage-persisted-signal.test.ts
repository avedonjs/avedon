import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, storagePersistedSignal } from './index.js'

describe('storagePersistedSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves navigator.storage.persisted and cleans up', async () => {
    const listeners = new Map<string, Set<() => void>>()
    const persisted = vi.fn(async () => true)
    vi.stubGlobal('navigator', { storage: { persisted } })
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
    const flag = storagePersistedSignal()
    __lifecycleEnd()
    expect(flag.get()).toBe(null)
    await vi.waitFor(() => {
      expect(flag.get()).toBe(true)
    })

    persisted.mockResolvedValueOnce(false)
    for (const cb of listeners.get('focus') ?? []) cb()
    await vi.waitFor(() => {
      expect(flag.get()).toBe(false)
    })

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
  })

  it('stays null without storage.persisted', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', undefined)
    expect(storagePersistedSignal().get()).toBe(null)
  })
})
