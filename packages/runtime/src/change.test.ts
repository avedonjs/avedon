import { describe, expect, it, vi } from 'vitest'
import { change } from './index.js'

describe('change', () => {
  it('fires with value on change and cleans up', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'picked',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = change(node as never, handler)

    listeners.get('change')!({ type: 'change' })
    expect(handler).toHaveBeenCalledWith('picked', expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      value: 'x',
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = change(node as never, handler)
    action.update(null)
    listeners.get('change')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
