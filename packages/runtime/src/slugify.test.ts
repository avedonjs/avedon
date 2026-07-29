import { describe, expect, it, vi } from 'vitest'
import { slugify } from './index.js'

describe('slugify', () => {
  it('slugifies value on blur and cleans up', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '  Hello World!! ',
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
    const action = slugify(el as never)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('hello-world')
    expect(el.dispatchEvent).toHaveBeenCalled()
    action.destroy()
    expect(listeners.get('blur')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'Hello',
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
    const action = slugify(el as never)
    action.update(false)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('Hello')
    expect(el.dispatchEvent).not.toHaveBeenCalled()
  })
})
