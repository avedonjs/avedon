import { describe, expect, it } from 'vitest'
import { email } from './index.js'

describe('email', () => {
  it('keeps email characters and lowercases on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'User+Tag@Example.COM!',
      selectionStart: 22,
      setSelectionRange: () => {},
      dispatchEvent: () => true,
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
    }
    const action = email(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('user+tag@example.com')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'A B',
      selectionStart: 3,
      setSelectionRange: () => {},
      dispatchEvent: () => true,
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: () => {},
    }
    const action = email(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('A B')
  })
})
