import { afterEach, describe, expect, it, vi } from 'vitest'
import { lazy } from './index.js'

describe('lazy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('copies data-src to src when intersecting', () => {
    let callback: IntersectionObserverCallback | null = null
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe = observe
        disconnect = disconnect
        unobserve = vi.fn()
        takeRecords = () => []
        root = null
        rootMargin = ''
        thresholds = []
      },
    )

    const attrs = new Map([['data-src', 'https://example.com/a.png']])
    const node = {
      src: '',
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: vi.fn(),
      removeAttribute: (name: string) => attrs.delete(name),
    }
    lazy(node as never)
    expect(observe).toHaveBeenCalled()

    callback?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(node.src).toBe('https://example.com/a.png')
    expect(attrs.has('data-src')).toBe(false)
    expect(disconnect).toHaveBeenCalled()
  })
})
