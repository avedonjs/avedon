import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, htmlLangSignal } from './index.js'

describe('htmlLangSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads and writes documentElement.lang', () => {
    const documentElement = { lang: 'en' }
    vi.stubGlobal('document', { documentElement })
    vi.stubGlobal('MutationObserver', undefined)

    __lifecycleBegin()
    const lang = htmlLangSignal()
    expect(lang.get()).toBe('en')
    lang.set('tr')
    expect(documentElement.lang).toBe('tr')
    expect(lang.get()).toBe('tr')
    __lifecycleEnd()
  })

  it('defaults to empty string without document', () => {
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('MutationObserver', undefined)
    expect(htmlLangSignal().get()).toBe('')
  })
})
