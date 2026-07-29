import { describe, expect, it, vi } from 'vitest'
import { copy } from './index.js'

describe('copy', () => {
  it('writes text to the clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const listeners = new Map<string, () => void>()
    const node = {
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }

    const action = copy(node as never, 'hello')
    listeners.get('click')!()
    expect(writeText).toHaveBeenCalledWith('hello')

    action.update(() => 'next')
    listeners.get('click')!()
    expect(writeText).toHaveBeenCalledWith('next')

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('no-ops when source is null', () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const listeners = new Map<string, () => void>()
    const node = {
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    copy(node as never, null)
    listeners.get('click')!()
    expect(writeText).not.toHaveBeenCalled()
  })
})
