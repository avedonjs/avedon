import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, tweened } from './index.js'

describe('tweened', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('jumps immediately when duration is 0', () => {
    const t = tweened(0, { duration: 0 })
    t.set(42)
    expect(t.get()).toBe(42)
  })

  it('interpolates across animation frames', () => {
    let now = 0
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames.length = 0
    })

    const t = tweened(0, { duration: 100 })
    t.set(100)
    expect(frames.length).toBe(1)

    now = 50
    frames.shift()!(now)
    expect(t.get()).toBe(50)

    now = 100
    frames.shift()!(now)
    expect(t.get()).toBe(100)
  })

  it('cancels in-flight frames on destroy', () => {
    const cancelled: number[] = []
    vi.stubGlobal('requestAnimationFrame', () => 7)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id)
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const t = tweened(0, { duration: 200 })
    __lifecycleEnd()
    t.set(10)
    for (const c of cleanups) c()
    expect(cancelled).toContain(7)
  })
})
