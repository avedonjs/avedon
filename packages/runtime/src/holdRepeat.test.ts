import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdRepeat } from './index.js'

describe('holdRepeat', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires immediately then repeats while held', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = holdRepeat(node as never, { handler, delay: 200, interval: 50 })

    listeners.get('pointerdown')!({ button: 0 })
    expect(handler).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(200)
    expect(handler).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(100)
    expect(handler).toHaveBeenCalledTimes(4)

    listeners.get('pointerup')!({})
    vi.advanceTimersByTime(500)
    expect(handler).toHaveBeenCalledTimes(4)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('does nothing when disabled', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    holdRepeat(node as never, null)
    listeners.get('pointerdown')!({ button: 0 })
    vi.advanceTimersByTime(1000)
    expect(handler).not.toHaveBeenCalled()
  })
})
