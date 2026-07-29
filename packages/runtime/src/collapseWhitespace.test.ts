import { describe, expect, it } from 'vitest'
import { collapseWhitespace } from './index.js'

describe('collapseWhitespace', () => {
  it('collapses whitespace and trims on blur', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '  hello   world  ',
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
    const action = collapseWhitespace(el as never)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('hello world')
    action.destroy()
    expect(listeners.get('blur')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: '  a  b  ',
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
    const action = collapseWhitespace(el as never)
    action.update(false)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('  a  b  ')
  })
})
