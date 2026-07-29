import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, spring } from './index.js'

describe('spring', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('jumps immediately when hard is true', () => {
    const s = spring(0)
    s.set(42, { hard: true })
    expect(s.get()).toBe(42)
  })

  it('approaches the target across frames', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames.length = 0
    })

    const s = spring(0, { stiffness: 0.5, damping: 0.5, precision: 0.01 })
    s.set(100)
    expect(frames.length).toBe(1)

    frames.shift()!(0)
    expect(s.get()).toBeGreaterThan(0)
    expect(s.get()).toBeLessThanOrEqual(100)

    for (let i = 0; i < 80 && frames.length; i++) {
      frames.shift()!(0)
    }
    expect(s.get()).toBe(100)
  })

  it('cancels in-flight frames on destroy', () => {
    const cancelled: number[] = []
    vi.stubGlobal('requestAnimationFrame', () => 9)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id)
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const s = spring(0)
    __lifecycleEnd()
    s.set(10)
    for (const c of cleanups) c()
    expect(cancelled).toContain(9)
  })
})
