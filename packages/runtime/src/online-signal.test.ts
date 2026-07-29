import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, onlineSignal } from './index.js'

describe('onlineSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks online/offline events and cleans up', () => {
    let onLine = true
    const listeners = new Map<string, Set<() => void>>()
    vi.stubGlobal('navigator', {
      get onLine() {
        return onLine
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
    const online = onlineSignal()
    __lifecycleEnd()
    expect(online.get()).toBe(true)
    expect(() => online.set(false)).toThrow(/read-only/)

    onLine = false
    for (const cb of listeners.get('offline') ?? []) cb()
    expect(online.get()).toBe(false)

    onLine = true
    for (const cb of listeners.get('online') ?? []) cb()
    expect(online.get()).toBe(true)

    for (const c of cleanups) c()
    expect(listeners.get('online')?.size ?? 0).toBe(0)
    expect(listeners.get('offline')?.size ?? 0).toBe(0)
  })

  it('defaults to true without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(onlineSignal().get()).toBe(true)
  })
})
