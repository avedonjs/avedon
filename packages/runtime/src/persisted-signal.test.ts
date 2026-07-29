import { afterEach, describe, expect, it, vi } from 'vitest'
import { persistedSignal } from './index.js'

describe('persistedSignal', () => {
  const localMem = new Map<string, string>()
  const sessionMem = new Map<string, string>()

  afterEach(() => {
    localMem.clear()
    sessionMem.clear()
    vi.unstubAllGlobals()
  })

  function makeStorage(mem: Map<string, string>): Storage {
    return {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
      key: () => null,
      get length() {
        return mem.size
      },
    } satisfies Storage
  }

  function stubStorage() {
    vi.stubGlobal('localStorage', makeStorage(localMem))
    vi.stubGlobal('sessionStorage', makeStorage(sessionMem))
  }

  it('reads and writes JSON in localStorage', () => {
    stubStorage()
    localMem.set('count', '2')
    const n = persistedSignal('count', 0)
    expect(n.get()).toBe(2)
    n.set(5)
    expect(localMem.get('count')).toBe('5')
    n.update((x) => x + 1)
    expect(n.get()).toBe(6)
    expect(localMem.get('count')).toBe('6')
  })

  it('can use sessionStorage via options.storage', () => {
    stubStorage()
    sessionMem.set('tab', '"hello"')
    const s = persistedSignal('tab', 'fallback', { storage: 'session' })
    expect(s.get()).toBe('hello')
    s.set('world')
    expect(sessionMem.get('tab')).toBe('"world"')
    expect(localMem.has('tab')).toBe(false)
  })

  it('falls back when storage is missing or corrupt', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(persistedSignal('x', 9).get()).toBe(9)

    stubStorage()
    localMem.set('bad', '{')
    expect(persistedSignal('bad', 3).get()).toBe(3)
  })
})
