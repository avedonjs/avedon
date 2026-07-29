import { describe, expect, it, vi } from 'vitest'
import { pinch } from './index.js'

describe('pinch', () => {
  it('reports scale from two-pointer distance changes', () => {
    const listeners = new Map<string, (e: Record<string, unknown>) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: Record<string, unknown>) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = pinch(node as never, handler)

    listeners.get('pointerdown')!({ pointerId: 1, clientX: 0, clientY: 0 })
    listeners.get('pointerdown')!({ pointerId: 2, clientX: 100, clientY: 0 })
    listeners.get('pointermove')!({ pointerId: 2, clientX: 200, clientY: 0 })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ scale: 2, centerX: 100, centerY: 0 }),
    )

    action.destroy()
    expect(listeners.size).toBe(0)
  })
})
