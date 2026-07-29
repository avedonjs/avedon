import { describe, expect, it, vi } from 'vitest'
import { reveal } from './index.js'

describe('reveal', () => {
  it('adds the revealed class when intersecting', () => {
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

    const classList = {
      add: vi.fn(),
      remove: vi.fn(),
    }
    const node = { classList }
    const action = reveal(node as never, true)
    expect(observe).toHaveBeenCalled()

    callback?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(classList.add).toHaveBeenCalledWith('revealed')
    expect(disconnect).toHaveBeenCalled()

    action.destroy()
    expect(classList.remove).toHaveBeenCalledWith('revealed')
    vi.unstubAllGlobals()
  })
})
