import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, platformSignal } from './index.js'

describe('platformSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.platform and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let platform = 'Linux x86_64'
    vi.stubGlobal('navigator', {
      get platform() {
        return platform
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
    const platformSig = platformSignal()
    __lifecycleEnd()
    expect(platformSig.get()).toBe('Linux x86_64')

    platform = 'MacIntel'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(platformSig.get()).toBe('MacIntel')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(platformSignal().get()).toBe('')
  })
})
