import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, connectionRtt } from './index.js'

describe('connectionRtt', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.connection.rtt', () => {
    const listeners = new Set<() => void>()
    const connection = {
      rtt: 50,
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
    const rtt = connectionRtt()
    __lifecycleEnd()
    expect(rtt.get()).toBe(50)

    connection.rtt = 200
    for (const cb of listeners) cb()
    expect(rtt.get()).toBe(200)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to 0 without connection', () => {
    vi.stubGlobal('navigator', {})
    expect(connectionRtt().get()).toBe(0)
  })
})
