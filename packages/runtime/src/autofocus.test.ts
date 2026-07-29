import { describe, expect, it, vi } from 'vitest'
import { autofocus } from './index.js'

describe('autofocus', () => {
  it('focuses the node on a microtask', async () => {
    const focus = vi.fn()
    const node = { focus } as unknown as Element
    autofocus(node)
    expect(focus).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('skips when disabled and focuses when re-enabled', async () => {
    const focus = vi.fn()
    const node = { focus } as unknown as Element
    const action = autofocus(node, false)
    await Promise.resolve()
    expect(focus).not.toHaveBeenCalled()

    action.update(true)
    await Promise.resolve()
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
