import { describe, expect, it, vi } from 'vitest'
import { formdata } from './index.js'

describe('formdata', () => {
  it('fires with FormData and cleans up', () => {
    const listeners = new Map<string, (e: { formData: FormData }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { formData: FormData }) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const fd = new FormData()
    fd.set('n', 'avedon')
    const action = formdata(node as never, handler)

    listeners.get('formdata')!({ formData: fd })
    expect(handler).toHaveBeenCalledWith(fd, expect.objectContaining({ formData: fd }))

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: { formData: FormData }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { formData: FormData }) => void) =>
        listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = formdata(node as never, handler)
    action.update(null)
    listeners.get('formdata')!({ formData: new FormData() })
    expect(handler).not.toHaveBeenCalled()
  })
})
