import { describe, expect, it } from 'vitest'
import { creditCard } from './index.js'

describe('creditCard', () => {
  it('keeps digits, spaces, and hyphens on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '4111-1111 1111-1111x!',
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
    const action = creditCard(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('4111-1111 1111-1111')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'abc',
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
    const action = creditCard(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('abc')
  })
})
