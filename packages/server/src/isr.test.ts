import { describe, expect, it, vi } from 'vitest'
import { createPathLock, isStale } from './isr.js'

describe('isStale', () => {
  it('is stale when age >= revalidate seconds', () => {
    const now = 1_000_000
    expect(isStale(now - 60_000, 60, now)).toBe(true)
    expect(isStale(now - 59_999, 60, now)).toBe(false)
  })

  it('treats revalidate 0 as always stale', () => {
    expect(isStale(Date.now(), 0)).toBe(true)
  })
})

describe('createPathLock', () => {
  it('dedupes concurrent runs for the same key', async () => {
    const lock = createPathLock()
    let runs = 0
    const slow = () =>
      new Promise<void>((resolve) => {
        runs++
        setTimeout(resolve, 30)
      })

    lock.run('a', slow)
    lock.run('a', slow)
    expect(lock.has('a')).toBe(true)
    expect(lock.size).toBe(1)

    await vi.waitFor(() => expect(lock.has('a')).toBe(false))
    expect(runs).toBe(1)
  })

  it('allows a new run after the previous finishes', async () => {
    const lock = createPathLock()
    let runs = 0
    lock.run('b', async () => {
      runs++
    })
    await vi.waitFor(() => expect(lock.has('b')).toBe(false))
    lock.run('b', async () => {
      runs++
    })
    await vi.waitFor(() => expect(lock.has('b')).toBe(false))
    expect(runs).toBe(2)
  })
})
