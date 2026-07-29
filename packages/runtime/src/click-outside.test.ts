import { afterEach, describe, expect, it, vi } from 'vitest'
import { clickOutside } from './index.js'

describe('clickOutside', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('invokes handler on outside pointerdown and cleans up', () => {
    const listeners = new Map<string, Set<EventListener>>()
    vi.stubGlobal('document', {
      addEventListener(type: string, cb: EventListener, _opts?: unknown) {
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

    const inside = { nodeType: 1 }
    const node = {
      contains(t: unknown) {
        return t === inside
      },
    }
    const handler = vi.fn()
    const action = clickOutside(node as never, handler)

    for (const cb of listeners.get('pointerdown') ?? []) {
      cb({ target: inside } as never)
    }
    expect(handler).not.toHaveBeenCalled()

    const outside = { nodeType: 1 }
    for (const cb of listeners.get('pointerdown') ?? []) {
      cb({ target: outside } as never)
    }
    expect(handler).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(listeners.get('pointerdown')?.size ?? 0).toBe(0)
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
    const node = { contains: () => false }
    const a = vi.fn()
    const b = vi.fn()
    const action = clickOutside(node as never, a)
    action.update(b)
    for (const cb of listeners.get('pointerdown') ?? []) {
      cb({ target: { nodeType: 1 } } as never)
    }
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})
