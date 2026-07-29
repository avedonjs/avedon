import { describe, expect, it } from 'vitest'
import { swapCase } from './index.js'

describe('swapCase', () => {
  it('swaps letter casing on blur', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'Hello wORLD 123!',
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
    const action = swapCase(el as never)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('hELLO World 123!')
    action.destroy()
    expect(listeners.get('blur')?.size ?? 0).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, Set<() => void>>()
    const el = {
      value: 'Hello',
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
    const action = swapCase(el as never)
    action.update(false)
    for (const cb of listeners.get('blur') ?? []) cb()
    expect(el.value).toBe('Hello')
  })
})

