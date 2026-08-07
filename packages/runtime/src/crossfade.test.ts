import { describe, expect, it, vi } from 'vitest'
import { crossfadeReceive, crossfadeSend, __resetCrossfade } from './crossfade.js'

describe('crossfade', () => {
  it('receive completes send when keys match', () => {
    __resetCrossfade()
    const done = vi.fn()
    const from = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 1, height: 1 }),
    } as Element
    crossfadeSend('k', from, done)

    const styles: Record<string, string> = {}
    const to = {
      style: styles,
      getBoundingClientRect: () => ({ left: 40, top: 50, width: 1, height: 1 }),
      addEventListener: (_: string, fn: () => void) => {
        fn()
      },
    } as unknown as HTMLElement

    ;(globalThis as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = (
      cb: FrameRequestCallback,
    ) => {
      cb(0)
      return 0
    }

    crossfadeReceive('k', to, 100)
    expect(done).toHaveBeenCalled()
  })
})
