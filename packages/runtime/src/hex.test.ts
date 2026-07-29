import { describe, expect, it } from 'vitest'
import { hex } from './index.js'

describe('hex', () => {
  it('keeps optional hash and hex digits on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '#Ff0GxZ',
      selectionStart: 7,
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
    const action = hex(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('#ff0')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '#zz',
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
    const action = hex(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('#zz')
  })
})
