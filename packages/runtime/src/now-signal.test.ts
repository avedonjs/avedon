import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, nowSignal } from './index.js'

describe('nowSignal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks on the configured interval and cleans up', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const now = nowSignal({ interval: 100 })
    __lifecycleEnd()
    expect(now.get()).toBe(1_000_000)

    vi.advanceTimersByTime(100)
    expect(now.get()).toBe(1_000_100)

    const frozen = now.get()
    for (const c of cleanups) c()
    vi.advanceTimersByTime(100)
    expect(now.get()).toBe(frozen)
  })

  it('rejects writes', () => {
    const now = nowSignal({ interval: 60_000 })
    expect(() => now.set(0)).toThrow(/read-only/)
  })
})
