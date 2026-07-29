import { describe, expect, it } from 'vitest'
import { postalCode } from './index.js'

describe('postalCode', () => {
  it('keeps postal characters and uppercases on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'sw1a 1aa!',
      selectionStart: 9,
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
    const action = postalCode(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('SW1A 1AA')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a!',
      selectionStart: 2,
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
    const action = postalCode(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('a!')
  })
})
