import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, productSignal } from './index.js'

describe('productSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.product and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let product = 'Gecko'
    vi.stubGlobal('navigator', {
      get product() {
        return product
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
    const productSig = productSignal()
    __lifecycleEnd()
    expect(productSig.get()).toBe('Gecko')

    product = 'WebKit'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(productSig.get()).toBe('WebKit')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(productSignal().get()).toBe('')
  })
})
