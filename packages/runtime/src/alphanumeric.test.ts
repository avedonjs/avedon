import { describe, expect, it } from 'vitest'
import { alphanumeric } from './index.js'

describe('alphanumeric', () => {
  it('strips non-alphanumeric on input and cleans up', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a1!b2@c3',
      selectionStart: 8,
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
    const action = alphanumeric(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('a1b2c3')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'ab!',
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
    const action = alphanumeric(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('ab!')
  })
})
