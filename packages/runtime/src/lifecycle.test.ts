import { describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, onDestroy, onMount } from './index.js'

describe('onMount / onDestroy', () => {
  it('runs onMount after __lifecycleEnd on a microtask and registers cleanup', async () => {
    const cleanups: Array<() => void> = []
    const cleanup = vi.fn()
    const mount = vi.fn(() => cleanup)

    __lifecycleBegin(cleanups)
    onMount(mount)
    expect(mount).not.toHaveBeenCalled()
    __lifecycleEnd()
    expect(mount).not.toHaveBeenCalled()

    await Promise.resolve()
    expect(mount).toHaveBeenCalledTimes(1)
    expect(cleanups).toHaveLength(1)
    cleanups[0]!()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('registers onDestroy immediately on the cleanups list', () => {
    const cleanups: Array<() => void> = []
    const destroy = vi.fn()
    __lifecycleBegin(cleanups)
    onDestroy(destroy)
    __lifecycleEnd()
    expect(cleanups).toHaveLength(1)
    cleanups[0]!()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('is a no-op outside of mount initialization (SSR-safe)', () => {
    expect(() => onMount(() => {})).not.toThrow()
    expect(() => onDestroy(() => {})).not.toThrow()
  })
})
