import { describe, expect, it, vi } from 'vitest'
import { invalid } from './index.js'

describe('invalid', () => {
  it('fires on invalid, prevents default, and cleans up', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const preventDefault = vi.fn()
    const action = invalid(node as never, handler)

    listeners.get('invalid')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = invalid(node as never, handler)
    action.update(null)
    listeners.get('invalid')!({ preventDefault() {} })
    expect(handler).not.toHaveBeenCalled()
  })
})
