import { describe, expect, it } from 'vitest'
import { numeric } from './index.js'

describe('numeric', () => {
  it('strips non-digits on input and cleans up', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'a1b2c3',
      selectionStart: 6,
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
    const action = numeric(el as never)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('123')
    action.destroy()
    expect(listeners.get('input')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '12x',
      selectionStart: 3,
      setSelectionRange: () => {},
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
    const action = numeric(el as never)
    action.update(false)
    for (const cb of listeners.get('input') ?? []) cb()
    expect(el.value).toBe('12x')
  })
})
