import { describe, expect, it } from 'vitest'
import { removeDiacritics } from './index.js'

describe('removeDiacritics', () => {
  it('removes accent marks while typing', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'Héllö Žůlu 123!',
      selectionStart: 15,
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

    const action = removeDiacritics(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('Hello Zulu 123!')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'éèà',
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
    const action = removeDiacritics(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('éèà')
  })
})

