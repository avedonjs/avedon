import { describe, expect, it, vi } from 'vitest'
import { focus } from './index.js'

describe('focus', () => {
  it('reports focus/blur and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = focus(node as never, handler)

    listeners.get('focus')!({})
    expect(handler).toHaveBeenCalledWith(true, expect.anything())
    listeners.get('blur')!({})
    expect(handler).toHaveBeenCalledWith(false, expect.anything())

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
    const action = focus(node as never, handler)
    action.update(null)
    listeners.get('focus')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
