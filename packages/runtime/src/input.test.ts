import { describe, expect, it, vi } from 'vitest'
import { input } from './index.js'

describe('input', () => {
  it('fires with value on input and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'live',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = input(node as never, handler)

    listeners.get('input')!({ type: 'input' })
    expect(handler).toHaveBeenCalledWith('live', expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'x',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = input(node as never, handler)
    action.update(null)
    listeners.get('input')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
