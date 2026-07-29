import { describe, expect, it, vi } from 'vitest'
import { paste } from './index.js'

describe('paste', () => {
  it('reads plain text and preventDefaults by default', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = paste(node as never, handler)
    const preventDefault = vi.fn()
    listeners.get('paste')!({
      preventDefault,
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'hello' : '') },
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith('hello', expect.anything())
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
    const action = paste(node as never, handler)
    action.update(null)
    listeners.get('paste')!({
      preventDefault: vi.fn(),
      clipboardData: { getData: () => 'x' },
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
