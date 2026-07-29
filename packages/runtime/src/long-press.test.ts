import { afterEach, describe, expect, it, vi } from 'vitest'
import { longPress } from './index.js'

describe('longPress', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires after the hold duration and cleans up', () => {
    vi.useFakeTimers()
    const node = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const handler = vi.fn()
    const action = longPress(node as never, { handler, duration: 200 })

    const down = node.addEventListener.mock.calls.find((c) => c[0] === 'pointerdown')?.[1] as
      | ((e: { button: number }) => void)
      | undefined
    expect(down).toBeTypeOf('function')
    down!({ button: 0 })
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(199)
    expect(handler).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(node.removeEventListener).toHaveBeenCalled()
  })

  it('cancels when pointer is released early', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (e: { button?: number }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { button?: number }) => void) => {
        listeners.set(type, cb)
      },
      removeEventListener: (type: string) => {
        listeners.delete(type)
      },
    }
    const handler = vi.fn()
    longPress(node as never, handler)

    listeners.get('pointerdown')!({ button: 0 })
    listeners.get('pointerup')!({})
    vi.advanceTimersByTime(1000)
    expect(handler).not.toHaveBeenCalled()
  })
})
