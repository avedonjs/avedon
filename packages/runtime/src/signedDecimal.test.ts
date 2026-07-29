import { describe, expect, it } from 'vitest'
import { signedDecimal } from './index.js'

describe('signedDecimal', () => {
  it('keeps optional minus, digits, and one dot on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '-12a3.4.5+',
      selectionStart: 10,
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
    const action = signedDecimal(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('-123.45')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '-1.2x',
      selectionStart: 5,
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
    const action = signedDecimal(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('-1.2x')
  })
})
