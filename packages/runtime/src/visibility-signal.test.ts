import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, visibilitySignal } from './index.js'

describe('visibilitySignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks visibilitychange and cleans up', () => {
    let visibilityState: DocumentVisibilityState = 'visible'
    const listeners = new Set<() => void>()
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibilityState
      },
      addEventListener: (_: string, cb: () => void) => {
        listeners.add(cb)
      },
      removeEventListener: (_: string, cb: () => void) => {
        listeners.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const vis = visibilitySignal()
    __lifecycleEnd()
    expect(vis.get()).toBe('visible')
    expect(() => vis.set('hidden')).toThrow(/read-only/)

    visibilityState = 'hidden'
    for (const cb of listeners) cb()
    expect(vis.get()).toBe('hidden')

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to visible without document', () => {
    vi.stubGlobal('document', undefined)
    expect(visibilitySignal().get()).toBe('visible')
  })
})
