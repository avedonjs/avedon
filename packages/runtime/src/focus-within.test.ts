import { describe, expect, it, vi } from 'vitest'
import { focusWithin } from './index.js'

describe('focusWithin', () => {
  it('reports focus enter/leave within the subtree', () => {
    const listeners = new Map<string, (e: { relatedTarget?: Node | null }) => void>()
    const child = {} as Node
    const outside = {} as Node
    const node = {
      contains: (n: Node) => n === child,
      addEventListener: (type: string, cb: (e: { relatedTarget?: Node | null }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = focusWithin(node as never, handler)

    listeners.get('focusin')!({})
    expect(handler).toHaveBeenCalledWith(true, expect.anything())

    listeners.get('focusout')!({ relatedTarget: child })
    expect(handler).toHaveBeenCalledTimes(1)

    listeners.get('focusout')!({ relatedTarget: outside })
    expect(handler).toHaveBeenCalledWith(false, expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })
})
