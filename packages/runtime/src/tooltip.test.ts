import { afterEach, describe, expect, it, vi } from 'vitest'
import { tooltip } from './index.js'

describe('tooltip', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('shows and hides tooltip content on pointer enter/leave', () => {
    const tip = {
      setAttribute: vi.fn(),
      style: {} as Record<string, string>,
      textContent: '',
      remove: vi.fn(),
    }
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => tip,
      body: { appendChild },
    })
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0 })

    const listeners = new Map<string, () => void>()
    const node = {
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 40,
        height: 20,
        right: 50,
        bottom: 40,
      }),
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const action = tooltip(node as never, 'Hello')

    listeners.get('pointerenter')!()
    expect(appendChild).toHaveBeenCalledWith(tip)
    expect(tip.textContent).toBe('Hello')
    expect(tip.setAttribute).toHaveBeenCalledWith('role', 'tooltip')

    listeners.get('pointerleave')!()
    expect(tip.remove).toHaveBeenCalled()

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('respects delay before showing', () => {
    vi.useFakeTimers()
    const tip = {
      setAttribute: vi.fn(),
      style: {} as Record<string, string>,
      textContent: '',
      remove: vi.fn(),
    }
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => tip,
      body: { appendChild },
    })
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0 })

    const listeners = new Map<string, () => void>()
    const node = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        right: 10,
        bottom: 10,
      }),
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    tooltip(node as never, { content: 'Later', delay: 50 })
    listeners.get('pointerenter')!()
    expect(appendChild).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(appendChild).toHaveBeenCalledWith(tip)
    expect(tip.textContent).toBe('Later')
  })
})
