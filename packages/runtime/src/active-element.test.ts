import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, activeElement } from './index.js'

describe('activeElement', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks focusin/focusout and cleans up', () => {
    const btn = { tagName: 'BUTTON', nodeType: 1 } as Element
    let active: Element | null = null
    const listeners = new Map<string, Set<() => void>>()
    vi.stubGlobal('document', {
      get activeElement() {
        return active
      },
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const focused = activeElement()
    __lifecycleEnd()
    expect(focused.get()).toBe(null)
    expect(() => focused.set(btn)).toThrow(/read-only/)

    active = btn
    for (const cb of listeners.get('focusin') ?? []) cb()
    expect(focused.get()).toBe(btn)

    for (const c of cleanups) c()
    expect(listeners.get('focusin')?.size ?? 0).toBe(0)
    expect(listeners.get('focusout')?.size ?? 0).toBe(0)
  })

  it('defaults to null without document', () => {
    vi.stubGlobal('document', undefined)
    expect(activeElement().get()).toBe(null)
  })
})
