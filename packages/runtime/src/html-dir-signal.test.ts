import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, htmlDirSignal } from './index.js'

describe('htmlDirSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads and writes documentElement.dir', () => {
    const documentElement = { dir: 'ltr' }
    vi.stubGlobal('document', { documentElement })
    vi.stubGlobal('MutationObserver', undefined)

    __lifecycleBegin()
    const dir = htmlDirSignal()
    expect(dir.get()).toBe('ltr')
    dir.set('rtl')
    expect(documentElement.dir).toBe('rtl')
    expect(dir.get()).toBe('rtl')
    __lifecycleEnd()
  })

  it('defaults to empty string without document', () => {
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('MutationObserver', undefined)
    expect(htmlDirSignal().get()).toBe('')
  })
})
