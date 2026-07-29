import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeKey } from './index.js'

describe('escapeKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('invokes handler on Escape and cleans up', () => {
    const listeners = new Map<string, Set<EventListener>>()
    vi.stubGlobal('document', {
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

    const handler = vi.fn()
    const action = escapeKey({} as never, handler)

    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'Enter' } as never)
    }
    expect(handler).not.toHaveBeenCalled()

    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'Escape' } as never)
    }
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.get('keydown')?.size ?? 0).toBe(0)
  })

  it('update swaps the handler', () => {
    const listeners = new Map<string, Set<EventListener>>()
    vi.stubGlobal('document', {
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
    const a = vi.fn()
    const b = vi.fn()
    const action = escapeKey({} as never, a)
    action.update(b)
    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'Escape' } as never)
    }
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})
