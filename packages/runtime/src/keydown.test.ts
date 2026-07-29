import { describe, expect, it, vi } from 'vitest'
import { keydown } from './index.js'

describe('keydown', () => {
  it('fires on the element when the key matches', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = keydown(node as never, { key: 'Enter', handler })
    const preventDefault = vi.fn()
    listeners.get('keydown')!({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)

    listeners.get('keydown')!({
      key: 'a',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    })
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
    const action = keydown(node as never, { key: 'Enter', handler })
    action.update(null)
    listeners.get('keydown')!({
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
