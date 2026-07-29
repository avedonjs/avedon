import { describe, expect, it, vi } from 'vitest'
import { selectOnFocus } from './index.js'

describe('selectOnFocus', () => {
  it('selects on focus and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const select = vi.fn()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
      select,
    }
    const action = selectOnFocus(node as never)
    listeners.get('focus')!({})
    expect(select).toHaveBeenCalledTimes(1)
    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('skips when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const select = vi.fn()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
      select,
    }
    const action = selectOnFocus(node as never)
    action.update(false)
    listeners.get('focus')!({})
    expect(select).not.toHaveBeenCalled()
  })
})
