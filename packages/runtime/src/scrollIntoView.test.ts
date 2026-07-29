import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollIntoView } from './index.js'

describe('scrollIntoView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrolls when enabled and on re-enable', async () => {
    vi.stubGlobal(
      'queueMicrotask',
      (fn: () => void) => {
        fn()
      },
    )
    const scroll = vi.fn()
    const node = { scrollIntoView: scroll }
    const action = scrollIntoView(node as never, false)
    expect(scroll).not.toHaveBeenCalled()

    action.update(true)
    expect(scroll).toHaveBeenCalledTimes(1)

    action.update({ behavior: 'smooth', block: 'center' })
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' })

    action.update({ when: false, behavior: 'smooth' })
    expect(scroll).toHaveBeenCalledTimes(2)
  })
})
