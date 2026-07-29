import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, doNotTrackSignal } from './index.js'

describe('doNotTrackSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.doNotTrack and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let dnt: string | null = '1'
    vi.stubGlobal('navigator', {
      get doNotTrack() {
        return dnt
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
    const dntSig = doNotTrackSignal()
    __lifecycleEnd()
    expect(dntSig.get()).toBe('1')

    dnt = '0'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(dntSig.get()).toBe('0')

    dnt = null
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(dntSig.get()).toBe('unspecified')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to unspecified without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(doNotTrackSignal().get()).toBe('unspecified')
  })
})
