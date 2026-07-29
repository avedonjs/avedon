import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, documentTitleSignal } from './index.js'

describe('documentTitleSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads and writes document.title', () => {
    const doc = { title: 'Initial' }
    vi.stubGlobal('document', doc)
    vi.stubGlobal('MutationObserver', undefined)

    __lifecycleBegin()
    const title = documentTitleSignal()
    expect(title.get()).toBe('Initial')
    title.set('Updated')
    expect(doc.title).toBe('Updated')
    expect(title.get()).toBe('Updated')
    __lifecycleEnd()
  })

  it('defaults to empty string without document', () => {
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('MutationObserver', undefined)
    expect(documentTitleSignal().get()).toBe('')
  })
})
