import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, localeSignal } from './index.js'

describe('localeSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.language and languagechange', () => {
    const listeners = new Set<() => void>()
    let language = 'en-US'
    vi.stubGlobal('navigator', {
      get language() {
        return language
      },
    })
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'languagechange') listeners.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        if (type === 'languagechange') listeners.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const locale = localeSignal()
    __lifecycleEnd()
    expect(locale.get()).toBe('en-US')

    language = 'tr-TR'
    for (const cb of listeners) cb()
    expect(locale.get()).toBe('tr-TR')

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to empty string without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(localeSignal().get()).toBe('')
  })
})
