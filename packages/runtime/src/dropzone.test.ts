import { describe, expect, it, vi } from 'vitest'
import { dropzone } from './index.js'

describe('dropzone', () => {
  it('forwards dropped files and tracks active state', () => {
    const listeners = new Map<string, (e: Record<string, unknown>) => void>()
    const node = {
      addEventListener: (type: string, cb: (e: Record<string, unknown>) => void) =>
        listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const handler = vi.fn()
    const onActive = vi.fn()
    const action = dropzone(node as never, { handler, onActive })

    const preventDefault = vi.fn()
    listeners.get('dragenter')!({ preventDefault })
    expect(onActive).toHaveBeenCalledWith(true)

    const file = { name: 'a.txt' } as File
    listeners.get('drop')!({
      preventDefault,
      dataTransfer: { files: [file] },
    })
    expect(handler).toHaveBeenCalledWith([file], expect.anything())
    expect(onActive).toHaveBeenCalledWith(false)

    action.destroy()
    expect(listeners.size).toBe(0)
  })
})
