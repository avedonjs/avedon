import { describe, expect, it } from 'vitest'
import { removePunct } from './index.js'

describe('removePunct', () => {
  it('removes punctuation while typing (keeps letters/digits/whitespace)', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a1! b2@ c3',
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
    const action = removePunct(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('a1 b2 c3')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a1! b2@ c3',
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
      removeEventListener: () => {},
    }
    const action = removePunct(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('a1! b2@ c3')
  })
})

