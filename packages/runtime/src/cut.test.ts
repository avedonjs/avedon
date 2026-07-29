import { describe, expect, it, vi } from 'vitest'
import { cut } from './index.js'

describe('cut', () => {
  it('reads plain text and preventDefaults by default', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'abcdef',
      selectionStart: 1,
      selectionEnd: 4,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = cut(node as never, handler)
    const preventDefault = vi.fn()
    listeners.get('cut')!({
      preventDefault,
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'bcd' : '') },
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith('bcd', expect.anything())
    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('falls back to selection when clipboardData is empty', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'abcdef',
      selectionStart: 2,
      selectionEnd: 5,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    cut(node as never, handler)
    listeners.get('cut')!({
      preventDefault: vi.fn(),
      clipboardData: { getData: () => '' },
    })
    expect(handler).toHaveBeenCalledWith('cde', expect.anything())
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = cut(node as never, handler)
    action.update(null)
    listeners.get('cut')!({
      preventDefault: vi.fn(),
      clipboardData: { getData: () => 'x' },
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
