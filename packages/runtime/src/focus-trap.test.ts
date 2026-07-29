import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusTrap } from './index.js'

describe('focusTrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wraps Tab from last to first and cleans up', () => {
    const listeners = new Map<string, Set<EventListener>>()
    const first = { focus: vi.fn() }
    const last = { focus: vi.fn() }
    const node = {
      contains: (el: unknown) => el === first || el === last,
      querySelectorAll: () => [first, last],
    }
    const doc = {
      activeElement: last as unknown,
      addEventListener(type: string, cb: EventListener) {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener(type: string, cb: EventListener) {
        listeners.get(type)?.delete(cb)
      },
    }
    vi.stubGlobal('document', doc)
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', display: 'block' }))

    const action = focusTrap(node as never)
    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() } as never)
    }
    expect(first.focus).toHaveBeenCalled()

    action.destroy()
    expect(listeners.get('keydown')?.size ?? 0).toBe(0)
  })

  it('can be disabled via update(false)', () => {
    const listeners = new Map<string, Set<EventListener>>()
    const first = { focus: vi.fn() }
    const node = {
      contains: () => true,
      querySelectorAll: () => [first],
    }
    vi.stubGlobal('document', {
      activeElement: first,
      addEventListener(type: string, cb: EventListener) {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener(type: string, cb: EventListener) {
        listeners.get(type)?.delete(cb)
      },
    })
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', display: 'block' }))

    const action = focusTrap(node as never)
    action.update(false)
    first.focus.mockClear()
    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() } as never)
    }
    expect(first.focus).not.toHaveBeenCalled()
  })
})
