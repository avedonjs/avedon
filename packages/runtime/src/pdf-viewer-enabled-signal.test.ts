import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, pdfViewerEnabledSignal } from './index.js'

describe('pdfViewerEnabledSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.pdfViewerEnabled and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let enabled = true
    vi.stubGlobal('navigator', {
      get pdfViewerEnabled() {
        return enabled
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
    const pdf = pdfViewerEnabledSignal()
    __lifecycleEnd()
    expect(pdf.get()).toBe(true)

    enabled = false
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(pdf.get()).toBe(false)

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to false without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    expect(pdfViewerEnabledSignal().get()).toBe(false)
  })
})
