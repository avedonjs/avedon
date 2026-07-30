import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetPreloadCache,
  getCachedHtml,
  invalidatePreload,
  preload,
  preloadCacheKey,
  resolvePreloadMode,
  shouldPreloadHref,
  shouldSkipPreload,
  takeCachedHtml,
} from './preload.js'

describe('preload', () => {
  afterEach(() => {
    __resetPreloadCache()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolvePreloadMode defaults to hover', () => {
    const el = {
      closest: () => null,
    } as unknown as Element
    expect(resolvePreloadMode(el)).toBe('hover')
  })

  it('resolvePreloadMode inherits from closest ancestor', () => {
    const host = {
      getAttribute: (name: string) => (name === 'data-avedon-preload' ? 'viewport' : null),
    }
    const el = {
      closest: (sel: string) => (sel.includes('data-avedon-preload') ? host : null),
    } as unknown as Element
    expect(resolvePreloadMode(el)).toBe('viewport')
  })

  it('resolvePreloadMode treats unknown values as hover', () => {
    const host = {
      getAttribute: () => 'nope',
    }
    const el = {
      closest: () => host,
    } as unknown as Element
    expect(resolvePreloadMode(el)).toBe('hover')
  })

  it('shouldSkipPreload respects saveData', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    expect(shouldSkipPreload()).toBe(true)
  })

  it('shouldSkipPreload respects prefers-reduced-data', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-data'),
      media: q,
    }))
    expect(shouldSkipPreload()).toBe(true)
  })

  it('shouldPreloadHref skips hash, blank, download, external, current', () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/posts/1',
      origin: 'http://localhost',
      pathname: '/posts/1',
      search: '',
    })
    expect(shouldPreloadHref('#x')).toBe(false)
    expect(
      shouldPreloadHref('/docs', {
        anchor: { target: '_blank', hasAttribute: () => false } as unknown as HTMLAnchorElement,
      }),
    ).toBe(false)
    expect(
      shouldPreloadHref('/docs', {
        anchor: {
          target: '',
          hasAttribute: (n: string) => n === 'download',
        } as unknown as HTMLAnchorElement,
      }),
    ).toBe(false)
    expect(shouldPreloadHref('https://example.com/x')).toBe(false)
    expect(shouldPreloadHref('/posts/1')).toBe(false)
    expect(shouldPreloadHref('/docs/intro')).toBe(true)
  })

  it('preload fetches once and dedupes in-flight', async () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++
        await new Promise((r) => setTimeout(r, 5))
        return { text: async () => '<html>ok</html>' }
      }),
    )

    const a = preload('/docs/intro')
    const b = preload('/docs/intro')
    await Promise.all([a, b])
    expect(calls).toBe(1)
    expect(await getCachedHtml(preloadCacheKey('/docs/intro'))).toBe('<html>ok</html>')
  })

  it('preload no-ops under Save-Data', async () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await preload('/docs')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('takeCachedHtml removes the entry', async () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    vi.stubGlobal('fetch', async () => ({ text: async () => 'BODY' }))
    await preload('/a')
    const key = preloadCacheKey('/a')
    expect(await takeCachedHtml(key)).toBe('BODY')
    expect(getCachedHtml(key)).toBeNull()
  })

  it('LRU evicts oldest beyond 20', async () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    vi.stubGlobal('fetch', async (url: string) => ({
      text: async () => `html:${url}`,
    }))
    for (let i = 0; i < 21; i++) {
      await preload(`/p${i}`)
    }
    expect(getCachedHtml(preloadCacheKey('/p0'))).toBeNull()
    expect(await getCachedHtml(preloadCacheKey('/p20'))).toBe('html:/p20')
  })

  it('invalidatePreload drops a key', async () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    vi.stubGlobal('fetch', async () => ({ text: async () => 'x' }))
    await preload('/z')
    invalidatePreload(preloadCacheKey('/z'))
    expect(getCachedHtml(preloadCacheKey('/z'))).toBeNull()
  })

  it('failed preload clears cache', async () => {
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
    })
    vi.stubGlobal('fetch', async () => {
      throw new Error('network')
    })
    await preload('/fail')
    expect(getCachedHtml(preloadCacheKey('/fail'))).toBeNull()
  })
})
