import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, hashSignal } from './index.js'

describe('hashSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks hashchange and writes location.hash', () => {
    const location = { hash: '' }
    const listeners = new Set<() => void>()
    vi.stubGlobal('window', {
      location,
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'hashchange') listeners.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        if (type === 'hashchange') listeners.delete(cb)
      },
    })
    vi.stubGlobal('location', location)

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const hash = hashSignal()
    __lifecycleEnd()
    expect(hash.get()).toBe('')

    hash.set('#section')
    expect(location.hash).toBe('#section')
    expect(hash.get()).toBe('#section')

    location.hash = '#other'
    for (const cb of listeners) cb()
    expect(hash.get()).toBe('#other')

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to empty string without location', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('location', undefined)
    expect(hashSignal().get()).toBe('')
  })
})
