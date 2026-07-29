import { describe, expect, it, vi } from 'vitest'
import { selectionchange } from './index.js'

describe('selectionchange', () => {
  it('reports selection via select event and cleans up', () => {
    const nodeListeners = new Map<string, () => void>()
    const docListeners = new Map<string, () => void>()
    const node = {
      selectionStart: 1,
      selectionEnd: 4,
      value: 'abcdef',
      addEventListener: (type: string, cb: () => void) => nodeListeners.set(type, cb),
      removeEventListener: (type: string) => nodeListeners.delete(type),
    }
    const doc = {
      activeElement: node,
      addEventListener: (type: string, cb: () => void) => docListeners.set(type, cb),
      removeEventListener: (type: string) => docListeners.delete(type),
    }
    vi.stubGlobal('document', doc)

    const handler = vi.fn()
    const action = selectionchange(node as never, handler)
    nodeListeners.get('select')!()
    expect(handler).toHaveBeenCalledWith({ start: 1, end: 4, text: 'bcd' })

    action.destroy()
    expect(nodeListeners.size).toBe(0)
    expect(docListeners.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('ignores when another element is focused', () => {
    const nodeListeners = new Map<string, () => void>()
    const node = {
      selectionStart: 0,
      selectionEnd: 1,
      value: 'ab',
      addEventListener: (type: string, cb: () => void) => nodeListeners.set(type, cb),
      removeEventListener: () => {},
    }
    vi.stubGlobal('document', {
      activeElement: {},
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    const handler = vi.fn()
    selectionchange(node as never, handler)
    nodeListeners.get('select')!()
    expect(handler).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
