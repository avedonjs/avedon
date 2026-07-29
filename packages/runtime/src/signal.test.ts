import { describe, expect, it, vi } from 'vitest'
import { batch, computed, effect, get, readonly, signal, untrack } from './index.js'

describe('signal', () => {
  it('get/set and subscribe', () => {
    const n = signal(1)
    expect(n.get()).toBe(1)
    const spy = vi.fn()
    const unsub = n.subscribe(spy)
    expect(spy).toHaveBeenCalledWith(1)
    n.set(2)
    expect(spy).toHaveBeenCalledWith(2)
    unsub()
    n.set(3)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('computed + effect', () => {
    const a = signal(2)
    const b = computed(() => a.get() * 3)
    expect(b.get()).toBe(6)
    const seen: number[] = []
    effect(() => {
      seen.push(b.get())
    })
    a.set(3)
    expect(b.get()).toBe(9)
    expect(seen.at(-1)).toBe(9)
  })

  it('get() helper', () => {
    expect(get(signal('x'))).toBe('x')
  })

  it('untrack skips dependency collection', () => {
    const a = signal(1)
    const b = signal(10)
    const seen: number[] = []
    effect(() => {
      seen.push(a.get() + untrack(() => b.get()))
    })
    expect(seen).toEqual([11])
    b.set(20)
    expect(seen).toEqual([11])
    a.set(2)
    expect(seen.at(-1)).toBe(22)
  })

  it('batch coalesces effect runs across multiple writes', () => {
    const a = signal(0)
    const b = signal(0)
    const runs: number[] = []
    effect(() => {
      runs.push(a.get() + b.get())
    })
    expect(runs).toEqual([0])
    batch(() => {
      a.set(1)
      b.set(2)
    })
    expect(runs).toEqual([0, 3])
  })

  it('nested batch flushes once at the outermost end', () => {
    const a = signal(0)
    const runs: number[] = []
    effect(() => {
      runs.push(a.get())
    })
    batch(() => {
      a.set(1)
      batch(() => {
        a.set(2)
      })
      a.set(3)
    })
    expect(runs).toEqual([0, 3])
  })

  it('readonly mirrors get/subscribe but rejects writes', () => {
    const src = signal(1)
    const ro = readonly(src)
    expect(ro.get()).toBe(1)
    expect(() => ro.set(2)).toThrow(/read-only|cannot be set/i)
    expect(() => ro.update((n) => n + 1)).toThrow(/read-only|cannot be updated/i)
    const seen: number[] = []
    effect(() => {
      seen.push(ro.get())
    })
    src.set(5)
    expect(ro.get()).toBe(5)
    expect(seen.at(-1)).toBe(5)
  })
})
