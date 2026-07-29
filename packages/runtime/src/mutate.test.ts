import { describe, expect, it, vi } from 'vitest'
import { mutate } from './index.js'

describe('mutate', () => {
  it('observes the node and forwards records', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    let cb: ((records: MutationRecord[]) => void) | null = null
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(fn: (records: MutationRecord[]) => void) {
          cb = fn
        }
        observe = observe
        disconnect = disconnect
      },
    )

    const node = {} as Element
    const handler = vi.fn()
    const action = mutate(node, handler)
    expect(observe).toHaveBeenCalledWith(node, { childList: true, subtree: true })

    const records = [{ type: 'childList' }] as MutationRecord[]
    cb!(records)
    expect(handler).toHaveBeenCalledWith(records)

    action.destroy()
    expect(disconnect).toHaveBeenCalled()
  })

  it('disconnects when disabled', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor() {}
        observe = observe
        disconnect = disconnect
      },
    )
    const action = mutate({} as Element, () => {})
    expect(observe).toHaveBeenCalledTimes(1)
    action.update(null)
    expect(disconnect).toHaveBeenCalled()
    expect(observe).toHaveBeenCalledTimes(1)
  })
})
