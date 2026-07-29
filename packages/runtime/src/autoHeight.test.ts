import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoHeight } from './index.js'

describe('autoHeight', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets height from scrollHeight on input', () => {
    vi.stubGlobal(
      'queueMicrotask',
      (fn: () => void) => {
        fn()
      },
    )
    const listeners = new Map<string, (e: object) => void>()
    const style = { height: '' }
    const node = {
      style,
      scrollHeight: 64,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const action = autoHeight(node as never)
    expect(style.height).toBe('64px')
    ;(node as { scrollHeight: number }).scrollHeight = 96
    listeners.get('input')!({})
    expect(style.height).toBe('96px')
    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('skips resize when disabled', () => {
    vi.stubGlobal(
      'queueMicrotask',
      (fn: () => void) => {
        fn()
      },
    )
    const listeners = new Map<string, (e: object) => void>()
    const style = { height: '' }
    const node = {
      style,
      scrollHeight: 40,
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const action = autoHeight(node as never)
    expect(style.height).toBe('40px')
    action.update(false)
    style.height = 'keep'
    listeners.get('input')!({})
    expect(style.height).toBe('keep')
  })
})
