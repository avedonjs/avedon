import { describe, expect, it, vi } from 'vitest'
import { keyup } from './index.js'

describe('keyup', () => {
  it('fires on the element when the key is released', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = keyup(node as never, { key: 'Enter', handler })
    const preventDefault = vi.fn()
    listeners.get('keyup')!({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)
    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = keyup(node as never, { key: 'Enter', handler })
    action.update(null)
    listeners.get('keyup')!({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
