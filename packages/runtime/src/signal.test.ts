import { describe, expect, it, vi } from 'vitest'
import { computed, effect, get, signal } from './index.js'

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
})
