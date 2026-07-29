import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, pathnameSignal } from './index.js'

describe('pathnameSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks history changes and writes via pushState', () => {
    const location = { pathname: '/', href: 'http://localhost/', search: '', hash: '' }
    const listeners = new Set<() => void>()
    const pushState = vi.fn((_state: unknown, _title: string, url: URL) => {
      location.pathname = url.pathname
      location.href = url.toString()
    })
    vi.stubGlobal('window', {
      location,
      history: { state: null, pushState, replaceState: vi.fn() },
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'popstate') listeners.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        if (type === 'popstate') listeners.delete(cb)
      },
    })
    vi.stubGlobal('location', location)
    vi.stubGlobal('URL', URL)

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const path = pathnameSignal()
    __lifecycleEnd()
    expect(path.get()).toBe('/')

    path.set('/about')
    expect(path.get()).toBe('/about')
    expect(pushState).toHaveBeenCalled()
    expect(location.pathname).toBe('/about')

    for (const c of cleanups) c()
  })

  it('defaults to / without location', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('location', undefined)
    expect(pathnameSignal().get()).toBe('/')
  })
})
