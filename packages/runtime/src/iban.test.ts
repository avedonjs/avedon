import { describe, expect, it } from 'vitest'
import { iban } from './index.js'

describe('iban', () => {
  it('keeps IBAN characters and uppercases on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'gb82 west 1234 5698 7654 32!',
      selectionStart: 30,
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
    const action = iban(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('GB82 WEST 1234 5698 7654 32')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'gb!',
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
    const action = iban(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('gb!')
  })
})
