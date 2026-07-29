import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, appVersionSignal } from './index.js'

describe('appVersionSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.appVersion and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let version = '5.0 (Test)'
    vi.stubGlobal('navigator', {
      get appVersion() {
        return version
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
    const verSig = appVersionSignal()
    __lifecycleEnd()
    expect(verSig.get()).toBe('5.0 (Test)')

    version = '5.0 (Updated)'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(verSig.get()).toBe('5.0 (Updated)')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(appVersionSignal().get()).toBe('')
  })
})
