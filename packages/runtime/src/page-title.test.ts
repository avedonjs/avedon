import { describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, pageTitle, signal } from './index.js'

describe('pageTitle', () => {
  it('sets document.title and restores on cleanup', () => {
    const doc = { title: 'base' }
    vi.stubGlobal('document', doc)

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    pageTitle('avedon-title')
    __lifecycleEnd()
    expect(doc.title).toBe('avedon-title')

    for (const c of cleanups) c()
    expect(doc.title).toBe('base')
  })

  it('tracks a getter via effect', () => {
    const doc = { title: 'base' }
    vi.stubGlobal('document', doc)
    const name = signal('one')

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    pageTitle(() => `title-${name.get()}`)
    __lifecycleEnd()
    expect(doc.title).toBe('title-one')

    name.set('two')
    expect(doc.title).toBe('title-two')

    for (const c of cleanups) c()
    expect(doc.title).toBe('base')
  })

  it('no-ops outside lifecycle', () => {
    const doc = { title: 'base' }
    vi.stubGlobal('document', doc)
    pageTitle('nope')
    expect(doc.title).toBe('base')
  })
})
