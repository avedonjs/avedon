import { afterEach, describe, expect, it, vi } from 'vitest'
import { infiniteScroll } from './index.js'

describe('infiniteScroll', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires when near the bottom and re-arms after scrolling up', () => {
    vi.stubGlobal(
      'queueMicrotask',
      (fn: () => void) => {
        /* defer initial check */
      },
    )
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 200,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = infiniteScroll(node as never, { handler, offset: 50 })

    node.scrollTop = 800
    listeners.get('scroll')!({})
    expect(handler).toHaveBeenCalledTimes(1)

    listeners.get('scroll')!({})
    expect(handler).toHaveBeenCalledTimes(1)

    node.scrollTop = 100
    listeners.get('scroll')!({})
    node.scrollTop = 800
    listeners.get('scroll')!({})
    expect(handler).toHaveBeenCalledTimes(2)

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('does not fire when disabled', () => {
    vi.stubGlobal('queueMicrotask', () => {})
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      scrollTop: 900,
      scrollHeight: 1000,
      clientHeight: 200,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    infiniteScroll(node as never, { handler, disabled: true })
    listeners.get('scroll')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
