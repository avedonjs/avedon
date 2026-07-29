import { describe, expect, it, vi } from 'vitest'
import { composition } from './index.js'

describe('composition', () => {
  it('reports start/update/end and cleans up', () => {
    const listeners = new Map<string, (e: { data?: string }) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: { data?: string }) => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const action = composition(node as never, handler)

    listeners.get('compositionstart')!({ data: '' })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'start', data: '' }),
    )

    listeners.get('compositionupdate')!({ data: 'あ' })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'update', data: 'あ' }),
    )

    listeners.get('compositionend')!({ data: 'あ' })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ phase: 'end', data: 'あ' }))

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('ignores events when disabled', () => {
    const listeners = new Map<string, (e: object) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: object) => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    const handler = vi.fn()
    const action = composition(node as never, handler)
    action.update(null)
    listeners.get('compositionstart')!({})
    expect(handler).not.toHaveBeenCalled()
  })
})
