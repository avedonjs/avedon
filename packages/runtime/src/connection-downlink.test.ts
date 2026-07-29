import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, connectionDownlink } from './index.js'

describe('connectionDownlink', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.connection.downlink', () => {
    const listeners = new Set<() => void>()
    const connection = {
      downlink: 10,
      addEventListener: (_type: string, cb: () => void) => {
        listeners.add(cb)
      },
      removeEventListener: (_type: string, cb: () => void) => {
        listeners.delete(cb)
      },
    }
    vi.stubGlobal('navigator', { connection })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const down = connectionDownlink()
    __lifecycleEnd()
    expect(down.get()).toBe(10)

    connection.downlink = 1.5
    for (const cb of listeners) cb()
    expect(down.get()).toBe(1.5)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to 0 without connection', () => {
    vi.stubGlobal('navigator', {})
    expect(connectionDownlink().get()).toBe(0)
  })
})
