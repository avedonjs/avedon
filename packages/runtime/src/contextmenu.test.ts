import { describe, expect, it, vi } from 'vitest'
import { contextmenu } from './index.js'

describe('contextmenu', () => {
  it('fires on contextmenu, prevents default, and cleans up', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const preventDefault = vi.fn()
    const action = contextmenu(node as never, handler)

    listeners.get('contextmenu')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('can skip preventDefault via options', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const preventDefault = vi.fn()
    contextmenu(node as never, { handler, preventDefault: false })
    listeners.get('contextmenu')!({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalled()
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = contextmenu(node as never, handler)
    action.update(null)
    listeners.get('contextmenu')!({ preventDefault() {} })
    expect(handler).not.toHaveBeenCalled()
  })
})
