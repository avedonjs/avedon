import { describe, expect, it, vi } from 'vitest'
import { drag } from './index.js'

describe('drag', () => {
  it('reports start/move/end with deltas', () => {
    const listeners = new Map<string, (e: Record<string, unknown>) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: Record<string, unknown>) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    }
    const handler = vi.fn()
    const action = drag(node as never, handler)

    listeners.get('pointerdown')!({ button: 0, pointerId: 1, clientX: 10, clientY: 20 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'start', dx: 0, dy: 0, x: 10, y: 20 }),
    )

    listeners.get('pointermove')!({ pointerId: 1, clientX: 40, clientY: 50 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'move', dx: 30, dy: 30, x: 40, y: 50 }),
    )

    listeners.get('pointerup')!({ pointerId: 1, clientX: 45, clientY: 55 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'end', dx: 35, dy: 35 }),
    )

    action.destroy()
    expect(listeners.size).toBe(0)
  })
})
