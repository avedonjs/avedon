import { describe, expect, it, vi } from 'vitest'
import { focusVisible } from './index.js'

describe('focusVisible', () => {
  it('adds class when :focus-visible matches', () => {
    const listeners = new Map<string, (e: object) => void>()
    const classes = new Set<string>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
      matches: (sel: string) => sel === ':focus-visible',
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
    const handler = vi.fn()
    const action = focusVisible(node as never, { handler })

    listeners.get('focus')!({})
    expect(classes.has('focus-visible')).toBe(true)
    expect(handler).toHaveBeenCalledWith(true, expect.anything())

    listeners.get('blur')!({})
    expect(classes.has('focus-visible')).toBe(false)
    expect(handler).toHaveBeenCalledWith(false, expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('skips class when focus is not :focus-visible', () => {
    const listeners = new Map<string, (e: object) => void>()
    const classes = new Set<string>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
      matches: () => false,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
    focusVisible(node as never)
    listeners.get('focus')!({})
    expect(classes.has('focus-visible')).toBe(false)
  })

  it('disables when param is null', () => {
    const listeners = new Map<string, (e: object) => void>()
    const classes = new Set<string>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
      matches: () => true,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
    const action = focusVisible(node as never)
    action.update(null)
    listeners.get('focus')!({})
    expect(classes.has('focus-visible')).toBe(false)
  })
})
