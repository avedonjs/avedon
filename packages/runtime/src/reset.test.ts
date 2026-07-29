import { describe, expect, it, vi } from 'vitest'
import { reset } from './index.js'

describe('reset', () => {
  it('fires on reset and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const form = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = reset(form as never, handler)

    listeners.get('reset')!({ type: 'reset' })
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('can preventDefault via options', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const form = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const preventDefault = vi.fn()
    const handler = vi.fn()
    reset(form as never, { handler, preventDefault: true })
    listeners.get('reset')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalled()
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const form = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = reset(form as never, handler)
    action.update(null)
    listeners.get('reset')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
