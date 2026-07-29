import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, vendorSignal } from './index.js'

describe('vendorSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.vendor and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let vendor = 'Google Inc.'
    vi.stubGlobal('navigator', {
      get vendor() {
        return vendor
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
    const vendorSig = vendorSignal()
    __lifecycleEnd()
    expect(vendorSig.get()).toBe('Google Inc.')

    vendor = 'Apple Computer, Inc.'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(vendorSig.get()).toBe('Apple Computer, Inc.')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(vendorSignal().get()).toBe('')
  })
})
