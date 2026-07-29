import { describe, expect, it, vi } from 'vitest'
import { dblclick } from './index.js'

describe('dblclick', () => {
  it('fires on dblclick and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = dblclick(node as never, handler)

    listeners.get('dblclick')!({ type: 'dblclick' })
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
    const action = dblclick(node as never, handler)
    action.update(null)
    listeners.get('dblclick')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
