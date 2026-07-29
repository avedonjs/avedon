import { describe, expect, it, vi } from 'vitest'
import { wheel } from './index.js'

describe('wheel', () => {
  it('fires on wheel and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = wheel(node as never, handler)

    listeners.get('wheel')!({ deltaY: 40 })
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('prevents default when requested', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const preventDefault = vi.fn()
    const handler = vi.fn()
    wheel(node as never, { handler, preventDefault: true })
    listeners.get('wheel')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalled()
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = wheel(node as never, handler)
    action.update(null)
    listeners.get('wheel')!({ deltaY: 1 })
    expect(handler).not.toHaveBeenCalled()
  })
})
