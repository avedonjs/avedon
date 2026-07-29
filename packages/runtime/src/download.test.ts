import { describe, expect, it, vi } from 'vitest'
import { download } from './index.js'

describe('download', () => {
  it('creates an object-URL link and clicks it', () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const remove = vi.fn()
    const appendChild = vi.fn()
    const a = { href: '', download: '', rel: '', click, remove }
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', {
      createElement: () => a,
      body: { appendChild },
    })

    const listeners = new Map<string, () => void>()
    const node = {
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }

    const action = download(node as never, { filename: 'hi.txt', data: 'hello' })
    listeners.get('click')!()

    expect(createObjectURL).toHaveBeenCalled()
    expect(a.download).toBe('hi.txt')
    expect(a.href).toBe('blob:test')
    expect(appendChild).toHaveBeenCalledWith(a)
    expect(click).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')

    action.destroy()
    expect(listeners.size).toBe(0)
  })

  it('no-ops when options are null', () => {
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    vi.stubGlobal('document', { createElement: vi.fn(), body: { appendChild: vi.fn() } })
    const listeners = new Map<string, () => void>()
    const node = {
      addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
      removeEventListener: () => {},
    }
    download(node as never, null)
    listeners.get('click')!()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
