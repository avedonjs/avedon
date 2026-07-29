import { afterEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './index.js'

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires handler after wait with the latest value', () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: '',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = debounce(node as never, { handler, wait: 100 })

    node.value = 'a'
    listeners.get('input')!({})
    node.value = 'ab'
    listeners.get('input')!({})
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('ab')

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
    debounce(node as never, null)
    listeners.get('input')!({})
    vi.advanceTimersByTime(1000)
    expect(handler).not.toHaveBeenCalled()
  })
})
