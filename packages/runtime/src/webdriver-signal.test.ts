import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, webdriverSignal } from './index.js'

describe('webdriverSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.webdriver and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let driven = true
    vi.stubGlobal('navigator', {
      get webdriver() {
        return driven
      },
    })
    vi.stubGlobal('window', {
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
    const bot = webdriverSignal()
    __lifecycleEnd()
    expect(bot.get()).toBe(true)

    driven = false
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(bot.get()).toBe(false)

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to false without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(webdriverSignal().get()).toBe(false)
  })
})
