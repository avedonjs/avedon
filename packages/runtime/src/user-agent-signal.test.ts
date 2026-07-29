import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, userAgentSignal } from './index.js'

describe('userAgentSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.userAgent and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let ua = 'AvedonTest/1.0'
    vi.stubGlobal('navigator', {
      get userAgent() {
        return ua
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
    const uaSig = userAgentSignal()
    __lifecycleEnd()
    expect(uaSig.get()).toBe('AvedonTest/1.0')

    ua = 'AvedonTest/2.0'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(uaSig.get()).toBe('AvedonTest/2.0')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(userAgentSignal().get()).toBe('')
  })
})
