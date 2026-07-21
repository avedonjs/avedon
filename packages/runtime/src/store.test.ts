import { describe, expect, it } from 'vitest'
import { get, writable } from './index.js'

describe('writable', () => {
  it('notifies subscribers on set', () => {
    const count = writable(0)
    const values: number[] = []
    const unsub = count.subscribe((v) => values.push(v))
    count.set(1)
    count.update((n) => n + 1)
    unsub()
    expect(values).toEqual([0, 1, 2])
    expect(get(count)).toBe(2)
  })
})
