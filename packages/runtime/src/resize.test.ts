import { describe, expect, it, vi } from 'vitest'
import { resize } from './index.js'

describe('resize', () => {
  it('observes the node and forwards entries', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    let cb: ((entries: ResizeObserverEntry[]) => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(fn: (entries: ResizeObserverEntry[]) => void) {
          cb = fn
        }
        observe = observe
        disconnect = disconnect
      },
    )

    const node = {} as Element
    const handler = vi.fn()
    const action = resize(node, handler)
    expect(observe).toHaveBeenCalledWith(node)

    const entry = { contentRect: { width: 120 } } as ResizeObserverEntry
    cb!([entry])
    expect(handler).toHaveBeenCalledWith(entry)

    action.destroy()
    expect(disconnect).toHaveBeenCalled()
  })

  it('ignores callbacks when handler is null', () => {
    let cb: ((entries: ResizeObserverEntry[]) => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(fn: (entries: ResizeObserverEntry[]) => void) {
          cb = fn
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    const handler = vi.fn()
    const action = resize({} as Element, handler)
    action.update(null)
    cb!([{ contentRect: { width: 1 } } as ResizeObserverEntry])
    expect(handler).not.toHaveBeenCalled()
  })
})
