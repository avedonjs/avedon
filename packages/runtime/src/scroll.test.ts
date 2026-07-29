import { describe, expect, it, vi } from 'vitest'
import { scroll } from './index.js'

describe('scroll', () => {
  it('reports scrollLeft/scrollTop and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      scrollLeft: 10,
      scrollTop: 20,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = scroll(node as never, handler)

    listeners.get('scroll')!({ type: 'scroll' })
    expect(handler).toHaveBeenCalledWith({ x: 10, y: 20 }, expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('fires immediately when requested', () => {
    const node = {
      scrollLeft: 3,
      scrollTop: 4,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    scroll(node as never, { handler, immediate: true })
    expect(handler).toHaveBeenCalledWith({ x: 3, y: 4 }, expect.any(Event))
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      scrollLeft: 0,
      scrollTop: 0,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = scroll(node as never, handler)
    action.update(null)
    listeners.get('scroll')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
