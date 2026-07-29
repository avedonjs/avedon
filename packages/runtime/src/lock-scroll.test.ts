import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetScrollLock, lockScroll } from './index.js'

describe('lockScroll', () => {
  afterEach(() => {
    __resetScrollLock()
    vi.unstubAllGlobals()
  })

  it('locks documentElement overflow and restores on destroy', () => {
    const html = { style: { overflow: '' } }
    const body = { style: { overflow: '' } }
    vi.stubGlobal('document', { documentElement: html, body })

    const action = lockScroll({} as never)
    expect(html.style.overflow).toBe('hidden')
    expect(body.style.overflow).toBe('hidden')

    action.destroy()
    expect(html.style.overflow).toBe('')
    expect(body.style.overflow).toBe('')
  })

  it('refcount keeps lock until the last release', () => {
    const html = { style: { overflow: 'auto' } }
    const body = { style: { overflow: 'scroll' } }
    vi.stubGlobal('document', { documentElement: html, body })

    const a = lockScroll({} as never)
    const b = lockScroll({} as never)
    expect(html.style.overflow).toBe('hidden')
    a.destroy()
    expect(html.style.overflow).toBe('hidden')
    b.destroy()
    expect(html.style.overflow).toBe('auto')
    expect(body.style.overflow).toBe('scroll')
  })

  it('update(false) unlocks while mounted', () => {
    const html = { style: { overflow: '' } }
    const body = { style: { overflow: '' } }
    vi.stubGlobal('document', { documentElement: html, body })

    const action = lockScroll({} as never, true)
    expect(html.style.overflow).toBe('hidden')
    action.update(false)
    expect(html.style.overflow).toBe('')
    action.update(true)
    expect(html.style.overflow).toBe('hidden')
    action.destroy()
  })
})
