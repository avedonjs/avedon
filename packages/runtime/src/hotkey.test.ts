import { afterEach, describe, expect, it, vi } from 'vitest'
import { hotkey } from './index.js'

describe('hotkey', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires on matching modifiers and cleans up', () => {
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
    const preventDefault = vi.fn()
    const action = hotkey({} as never, { key: 'k', ctrl: true, handler })

    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'k', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault } as never)
    }
    expect(handler).not.toHaveBeenCalled()

    for (const cb of listeners.get('keydown') ?? []) {
      cb({ key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, preventDefault } as never)
    }
    expect(handler).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()

    action.destroy()
    expect(listeners.get('keydown')?.size ?? 0).toBe(0)
  })
})
