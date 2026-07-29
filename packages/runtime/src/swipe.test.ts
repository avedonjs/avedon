import { describe, expect, it, vi } from 'vitest'
import { swipe } from './index.js'

describe('swipe', () => {
  it('reports horizontal swipe past threshold', () => {
    const listeners = new Map<string, (e: { button?: number; clientX: number; clientY: number }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { button?: number; clientX: number; clientY: number }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = swipe(node as never, { handler, threshold: 30 })

    listeners.get('pointerdown')!({ button: 0, clientX: 100, clientY: 50 })
    listeners.get('pointerup')!({ clientX: 40, clientY: 55 })
    expect(handler).toHaveBeenCalledWith({ direction: 'left', dx: -60, dy: 5 })

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores short movements', () => {
    const listeners = new Map<string, (e: { button?: number; clientX: number; clientY: number }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { button?: number; clientX: number; clientY: number }) => void) =>
        listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    swipe(node as never, handler)
    listeners.get('pointerdown')!({ button: 0, clientX: 10, clientY: 10 })
    listeners.get('pointerup')!({ clientX: 20, clientY: 12 })
    expect(handler).not.toHaveBeenCalled()
  })
})
