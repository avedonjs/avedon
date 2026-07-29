import { describe, expect, it, vi } from 'vitest'
import { fullscreen } from './index.js'

describe('fullscreen', () => {
  it('requests fullscreen on click and exits when already active', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const node = {
      requestFullscreen,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    let fullscreenElement: Element | null = null
    vi.stubGlobal('document', {
      get fullscreenElement() {
        return fullscreenElement
      },
      exitFullscreen,
    })

    const action = fullscreen(node as never)
    const onClick = node.addEventListener.mock.calls.find((c) => c[0] === 'click')?.[1] as
      | (() => void)
      | undefined
    expect(onClick).toBeTypeOf('function')

    onClick!()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)

    fullscreenElement = node as never
    onClick!()
    expect(exitFullscreen).toHaveBeenCalledTimes(1)

    action.destroy()
    expect(node.removeEventListener).toHaveBeenCalled()
    expect(exitFullscreen).toHaveBeenCalledTimes(2)
  })

  it('ignores clicks when disabled', () => {
    const requestFullscreen = vi.fn()
    const node = {
      requestFullscreen,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('document', { fullscreenElement: null, exitFullscreen: vi.fn() })
    fullscreen(node as never, false)
    const onClick = node.addEventListener.mock.calls.find((c) => c[0] === 'click')?.[1] as () => void
    onClick()
    expect(requestFullscreen).not.toHaveBeenCalled()
  })
})
