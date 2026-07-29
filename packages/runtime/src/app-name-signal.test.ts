import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, appNameSignal } from './index.js'

describe('appNameSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.appName and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let name = 'Netscape'
    vi.stubGlobal('navigator', {
      get appName() {
        return name
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
    const nameSig = appNameSignal()
    __lifecycleEnd()
    expect(nameSig.get()).toBe('Netscape')

    name = 'Other'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(nameSig.get()).toBe('Other')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(appNameSignal().get()).toBe('')
  })
})
