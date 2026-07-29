import { afterEach, describe, expect, it, vi } from 'vitest'
import { throttle } from './index.js'

describe('throttle', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires immediately then at most once per wait', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: '',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = throttle(node as never, { handler, wait: 100 })

    node.value = 'a'
    listeners.get('input')!({})
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('a')

    node.value = 'ab'
    listeners.get('input')!({})
    expect(handler).toHaveBeenCalledTimes(1)

    vi.setSystemTime(100)
    vi.advanceTimersByTime(100)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith('ab')

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('does nothing when disabled', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'x',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    throttle(node as never, null)
    listeners.get('input')!({})
    vi.advanceTimersByTime(1000)
    expect(handler).not.toHaveBeenCalled()
  })
})
