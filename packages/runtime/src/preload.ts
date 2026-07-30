/**
 * Same-origin HTML preload cache for client navigation (SvelteKit-like).
 */

export type PreloadMode = 'hover' | 'tap' | 'viewport' | 'off'

const ATTR = 'data-avedon-preload'
const MODES = new Set<PreloadMode>(['hover', 'tap', 'viewport', 'off'])
const LRU_MAX = 20

type CacheEntry = Promise<string> | string

const cache = new Map<string, CacheEntry>()

export function __resetPreloadCache(): void {
  cache.clear()
}

export function preloadCacheKey(pathname: string, search = ''): string {
  return pathname + search
}

export function resolvePreloadMode(el: Element): PreloadMode {
  const host = el.closest?.(`[${ATTR}]`) as Element | null
  if (!host) return 'hover'
  const raw = host.getAttribute(ATTR)?.trim().toLowerCase()
  if (raw && MODES.has(raw as PreloadMode)) return raw as PreloadMode
  return 'hover'
}

export function shouldSkipPreload(): boolean {
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return true
  }
  if (typeof matchMedia === 'function') {
    try {
      if (matchMedia('(prefers-reduced-data: reduce)').matches) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

function touchLru(key: string, value: CacheEntry): void {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > LRU_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function invalidatePreload(key: string): void {
  cache.delete(key)
}

/** Peek without removing. Returns resolved HTML, in-flight promise, or null. */
export function getCachedHtml(key: string): CacheEntry | null {
  return cache.get(key) ?? null
}

/**
 * Remove and return a cached entry (string or in-flight promise).
 * Used by navigate so the page is not reused as a "fresh" preload.
 */
export async function takeCachedHtml(key: string): Promise<string | null> {
  const entry = cache.get(key)
  if (entry === undefined) return null
  cache.delete(key)
  try {
    return await entry
  } catch {
    return null
  }
}

export type PreloadHrefOptions = {
  /** Anchor used for skip rules (`download`, `target`, etc.). */
  anchor?: HTMLAnchorElement | null
}

function sameOriginHref(href: string, base: string): { key: string; url: URL } | null {
  let url: URL
  try {
    url = new URL(href, base)
  } catch {
    return null
  }
  const origin = typeof location !== 'undefined' ? location.origin : url.origin
  if (url.origin !== origin) return null
  return { key: preloadCacheKey(url.pathname, url.search), url }
}

export function shouldPreloadHref(href: string, opts: PreloadHrefOptions = {}): boolean {
  if (!href || href.startsWith('#')) return false
  const a = opts.anchor
  if (a) {
    if (a.target === '_blank' || a.hasAttribute('download')) return false
  }
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/'
  const parsed = sameOriginHref(href, base)
  if (!parsed) return false
  if (typeof location !== 'undefined') {
    if (parsed.key === location.pathname + location.search) return false
  }
  return true
}

/**
 * Prefetch page HTML into the in-memory cache. No-ops when Save-Data /
 * reduced-data is on, or when the href is not preloadable.
 */
export async function preload(href: string, opts: PreloadHrefOptions = {}): Promise<void> {
  if (shouldSkipPreload()) return
  if (!shouldPreloadHref(href, opts)) return
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/'
  const parsed = sameOriginHref(href, base)
  if (!parsed) return
  const { key } = parsed
  if (cache.has(key)) {
    touchLru(key, cache.get(key)!)
    return
  }

  const pending = fetch(key, { headers: { accept: 'text/html' } })
    .then((res) => res.text())
    .then((html) => {
      touchLru(key, html)
      return html
    })
    .catch((err) => {
      cache.delete(key)
      throw err
    })

  touchLru(key, pending)
  try {
    await pending
  } catch {
    /* entry removed on failure */
  }
}
