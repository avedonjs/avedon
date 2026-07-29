import { describe, expect, it, vi } from 'vitest'
import { pressed } from './index.js'

describe('pressed', () => {
  it('adds class on pointerdown and removes on pointerup', () => {
    const listeners = new Map<string, (e: object) => void>()
    const classes = new Set<string>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
    const handler = vi.fn()
    const action = pressed(node as never, { handler })

    listeners.get('pointerdown')!({})
    expect(classes.has('pressed')).toBe(true)
    expect(handler).toHaveBeenCalledWith(true, expect.anything())

    listeners.get('pointerup')!({})
    expect(classes.has('pressed')).toBe(false)
    expect(handler).toHaveBeenCalledWith(false, expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('disables when param is null', () => {
    const listeners = new Map<string, (e: object) => void>()
    const classes = new Set<string>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
    const action = pressed(node as never)
    action.update(null)
    listeners.get('pointerdown')!({})
    expect(classes.has('pressed')).toBe(false)
  })
})
