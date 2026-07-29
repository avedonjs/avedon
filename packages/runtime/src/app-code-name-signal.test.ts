import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, appCodeNameSignal } from './index.js'

describe('appCodeNameSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.appCodeName and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let code = 'Mozilla'
    vi.stubGlobal('navigator', {
      get appCodeName() {
        return code
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
    const codeSig = appCodeNameSignal()
    __lifecycleEnd()
    expect(codeSig.get()).toBe('Mozilla')

    code = 'Other'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(codeSig.get()).toBe('Other')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(appCodeNameSignal().get()).toBe('')
  })
})
