import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, saveDataSignal } from './index.js'

describe('saveDataSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.connection.saveData', () => {
    const listeners = new Set<() => void>()
    const connection = {
      saveData: false,
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
    const save = saveDataSignal()
    __lifecycleEnd()
    expect(save.get()).toBe(false)

    connection.saveData = true
    for (const cb of listeners) cb()
    expect(save.get()).toBe(true)

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to false without connection', () => {
    vi.stubGlobal('navigator', {})
    expect(saveDataSignal().get()).toBe(false)
  })
})
