import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollspy } from './index.js'

describe('scrollspy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the id with the highest intersection ratio', () => {
    let callback: IntersectionObserverCallback | null = null
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        cb(0)
        return 0
      },
    )
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

    const a = { id: 'a' } as Element
    const b = { id: 'b' } as Element
    vi.stubGlobal('document', {
      getElementById: (id: string) => (id === 'a' ? a : id === 'b' ? b : null),
      querySelector: () => null,
    })

    const handler = vi.fn()
    scrollspy({} as Element, { sections: ['a', 'b'], handler })
    expect(observe).toHaveBeenCalledTimes(2)

    callback?.(
      [
        { target: a, isIntersecting: true, intersectionRatio: 0.2 } as IntersectionObserverEntry,
        { target: b, isIntersecting: true, intersectionRatio: 0.8 } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )
    expect(handler).toHaveBeenCalledWith('b')

    callback?.(
      [{ target: b, isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(handler).toHaveBeenLastCalledWith('a')
  })

  it('disables when param is null', () => {
    const observe = vi.fn()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        cb(0)
        return 0
      },
    )
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {}
        observe = observe
        disconnect = vi.fn()
        unobserve = vi.fn()
        takeRecords = () => []
        root = null
        rootMargin = ''
        thresholds = []
      },
    )
    scrollspy({} as Element, null)
    expect(observe).not.toHaveBeenCalled()
  })
})
