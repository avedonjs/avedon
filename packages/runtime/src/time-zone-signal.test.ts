import { afterEach, describe, expect, it, vi } from 'vitest'
import { __lifecycleBegin, __lifecycleEnd, timeZoneSignal } from './index.js'

describe('timeZoneSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('tracks resolved timeZone and re-reads on focus', () => {
    const listeners = new Map<string, Set<() => void>>()
    let tz = 'UTC'
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: tz }),
        }) as Intl.DateTimeFormat,
    )
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: () => void) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(cb)
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb)
      },
    })

    const cleanups: Array<() => void> = []
    __lifecycleBegin(cleanups)
    const zone = timeZoneSignal()
    __lifecycleEnd()
    expect(zone.get()).toBe('UTC')

    tz = 'Europe/Istanbul'
    for (const cb of listeners.get('focus') ?? []) cb()
    expect(zone.get()).toBe('Europe/Istanbul')

    for (const c of cleanups) c()
    expect(listeners.get('focus')?.size ?? 0).toBe(0)
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })

  it('defaults to empty string when Intl fails', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no intl')
    })
    vi.stubGlobal('window', undefined)
    expect(timeZoneSignal().get()).toBe('')
  })
})
