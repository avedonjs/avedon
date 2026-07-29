import { afterEach, describe, expect, it, vi } from 'vitest'
import { transitionMs } from './index.js'

describe('transitionMs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the given duration when reduced motion is off', () => {
    vi.stubGlobal('matchMedia', (query: string) => {
      expect(query).toBe('(prefers-reduced-motion: reduce)')
      return { matches: false } as MediaQueryList
    })
    expect(transitionMs(200)).toBe(200)
    expect(transitionMs(0)).toBe(0)
  })

  it('returns 0 when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }) as MediaQueryList)
    expect(transitionMs(200)).toBe(0)
    expect(transitionMs(80)).toBe(0)
  })
})
