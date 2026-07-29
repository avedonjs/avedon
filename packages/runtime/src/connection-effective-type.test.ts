import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, connectionEffectiveType } from './index.js'

describe('connectionEffectiveType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks navigator.connection.effectiveType', () => {
    const listeners = new Set<() => void>()
    const connection = {
      effectiveType: '4g',
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
    const type = connectionEffectiveType()
    __lifecycleEnd()
    expect(type.get()).toBe('4g')

    connection.effectiveType = '3g'
    for (const cb of listeners) cb()
    expect(type.get()).toBe('3g')

    for (const c of cleanups) c()
    expect(listeners.size).toBe(0)
  })

  it('defaults to empty string without connection', () => {
    vi.stubGlobal('navigator', {})
    expect(connectionEffectiveType().get()).toBe('')
  })
})
