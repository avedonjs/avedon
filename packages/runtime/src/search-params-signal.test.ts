import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, searchParamsSignal } from './index.js'

describe('searchParamsSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks history replaceState/pushState and writes via replaceState', () => {
    const location = { search: '', href: 'http://localhost/', pathname: '/', hash: '' }
    const replaceStateImpl = (_state: unknown, _title: string, url: string | URL) => {
      const next = typeof url === 'string' ? new URL(url, 'http://localhost/') : url
      location.search = next.search
      location.href = next.toString()
    }
    const pushStateImpl = (_state: unknown, _title: string, url: string | URL) => {
      const next = typeof url === 'string' ? new URL(url, 'http://localhost/') : url
      location.search = next.search
      location.href = next.toString()
    }
    const replaceState = vi.fn(replaceStateImpl)
    const pushState = vi.fn(pushStateImpl)
    vi.stubGlobal('window', {
      location,
      history: { state: null, replaceState, pushState },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('location', location)
    vi.stubGlobal('URL', URL)

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const search = searchParamsSignal()
    __lifecycleEnd()
    expect(search.get()).toBe('')

    search.set('q=hi')
    expect(search.get()).toBe('?q=hi')
    expect(replaceState).toHaveBeenCalled()
    expect(location.search).toBe('?q=hi')

    // External history mutation (e.g. router) should sync via the history patch.
    window.history.pushState(null, '', 'http://localhost/?q=from-history')
    expect(search.get()).toBe('?q=from-history')

    for (const c of cleanups) c()
  })

  it('defaults to empty string without location', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('location', undefined)
    expect(searchParamsSignal().get()).toBe('')
  })
})
