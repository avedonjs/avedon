import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, idleSignal } from './index.js'

describe('idleSignal', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('becomes idle after timeout and resets on activity', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, Set<() => void>>()
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
    const idle = idleSignal({ timeout: 100, events: ['mousemove'] })
    __lifecycleEnd()
    expect(idle.get()).toBe(false)

    vi.advanceTimersByTime(100)
    expect(idle.get()).toBe(true)

    for (const cb of listeners.get('mousemove') ?? []) cb()
    expect(idle.get()).toBe(false)

    vi.advanceTimersByTime(100)
    expect(idle.get()).toBe(true)

    for (const c of cleanups) c()
    expect(listeners.get('mousemove')?.size ?? 0).toBe(0)
  })
})
