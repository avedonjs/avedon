import { describe, expect, it, vi } from 'vitest'
import { submit } from './index.js'

describe('submit', () => {
  it('fires with FormData, prevents default, and cleans up', () => {
    const listeners = new Map<string, (e: { preventDefault: () => void }) => void>()
    const form = {
      addEventListener: (type: string, cb: (e: { preventDefault: () => void }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const preventDefault = vi.fn()
    const FormDataMock = vi.fn(function FormDataMock() {
      return { kind: 'fd' }
    })
    vi.stubGlobal('FormData', FormDataMock)

    const action = submit(form as never, handler)
    listeners.get('submit')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(FormDataMock).toHaveBeenCalledWith(form)
    expect(handler).toHaveBeenCalledWith({ kind: 'fd' }, expect.anything())

    action.destroy()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const form = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = submit(form as never, handler)
    action.update(null)
    listeners.get('submit')!({ preventDefault() {} })
    expect(handler).not.toHaveBeenCalled()
  })
})
