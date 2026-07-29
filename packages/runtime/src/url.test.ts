import { describe, expect, it } from 'vitest'
import { url } from './index.js'

describe('url', () => {
  it('keeps URL characters on input', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'HTTPS://Ex.com/a b?q=1|',
      selectionStart: 24,
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
    const action = url(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('HTTPS://Ex.com/ab?q=1')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a b',
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
    const action = url(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('a b')
  })
})
