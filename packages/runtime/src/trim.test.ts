import { describe, expect, it, vi } from 'vitest'
import { trim } from './index.js'

describe('trim', () => {
  it('trims value on blur and dispatches input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '  avedon  ',
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb)
      },
      dispatchEvent: vi.fn(),
    }
    const action = trim(el as never)

    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('avedon')
    expect(el.dispatchEvent).toHaveBeenCalled()

    action.destroy()
    expect(listeners.get('blur')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '  x  ',
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: () => {},
      dispatchEvent: vi.fn(),
    }
    const action = trim(el as never)
    action.update(false)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('  x  ')
    expect(el.dispatchEvent).not.toHaveBeenCalled()
  })
})
