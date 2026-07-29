import { describe, expect, it } from 'vitest'
import { maxLength } from './index.js'

describe('maxLength', () => {
  it('clamps value length on input and cleans up', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'abcdef',
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
    const action = maxLength(el as never, 3)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('abc')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'abcdef',
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
    const action = maxLength(el as never, 2)
    action.update(null)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('abcdef')
  })
})
