import { afterEach, describe, expect, it, vi } from 'vitest'
import { sticky } from './index.js'

describe('sticky', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listens to scroll and reports stuck from bounding rect', async () => {
    const listeners = new Map<string, () => void>()
    const addEventListener = vi.fn((type: string, cb: () => void) => listeners.set(type, cb))
    const removeEventListener = vi.fn((type: string) => listeners.delete(type))
    vi.stubGlobal('window', { addEventListener, removeEventListener })
    vi.stubGlobal('getComputedStyle', () => ({ position: 'sticky', top: '0px' }))

    let top = 80
    const node = {
      getBoundingClientRect: () => ({ top }),
    } as unknown as Element

    const handler = vi.fn()
    const action = sticky(node, handler)
    await Promise.resolve()
    expect(handler).not.toHaveBeenCalled()

    top = 0
    listeners.get('scroll')!()
    expect(handler).toHaveBeenCalledWith(true)

    action.destroy()
    expect(removeEventListener).toHaveBeenCalled()
  })
})
