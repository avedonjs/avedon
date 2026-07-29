import { afterEach, describe, expect, it, vi } from 'vitest'
import { inView } from './index.js'

describe('inView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('observes the node and forwards intersection details', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    let callback: IntersectionObserverCallback | null = null
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

    const node = {} as Element
    const handler = vi.fn()
    const action = inView(node, handler)
    expect(observe).toHaveBeenCalledWith(node)

    callback?.(
      [{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(handler).toHaveBeenCalledWith({ isIntersecting: true, ratio: 0.5 })

    action.destroy()
    expect(disconnect).toHaveBeenCalled()
  })

  it('once disconnects after the first intersecting callback', () => {
    const disconnect = vi.fn()
    let callback: IntersectionObserverCallback | null = null
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe = vi.fn()
        disconnect = disconnect
        unobserve = vi.fn()
        takeRecords = () => []
        root = null
        rootMargin = ''
        thresholds = []
      },
    )

    const handler = vi.fn()
    inView({} as Element, { handler, once: true })
    callback?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(handler).toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalled()
  })
})
