import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, localesSignal } from './index.js'

describe('localesSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.languages and languagechange', () => {
    const listeners = new Set<() => void>()
    let languages: string[] = ['en-US', 'en']
    vi.stubGlobal('navigator', {
      get languages() {
        return languages
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
    const locales = localesSignal()
    __lifecycleEnd()
    expect(locales.get()).toEqual(['en-US', 'en'])

    languages = ['tr-TR', 'en-US']
    for (const cb of listeners) cb()
    expect(locales.get()).toEqual(['tr-TR', 'en-US'])

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to empty array without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(localesSignal().get()).toEqual([])
  })
})
