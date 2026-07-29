import { describe, expect, it, vi } from 'vitest'
import { tick } from './index.js'

describe('tick', () => {
  it('resolves after two microtasks (after a typical __invalidate flush)', async () => {
    const order: string[] = []
    queueMicrotask(() => {
      order.push('invalidate')
    })
    const p = tick().then(() => {
      order.push('tick')
    })
    order.push('sync')
    await p
    expect(order).toEqual(['sync', 'invalidate', 'tick'])
  })

  it('can be awaited multiple times independently', async () => {
    const a = vi.fn()
    const b = vi.fn()
    await Promise.all([tick().then(a), tick().then(b)])
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
