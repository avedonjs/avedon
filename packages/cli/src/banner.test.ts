import { describe, expect, it } from 'vitest'
import { printDevBanner, shouldPrintDevBanner } from './banner.js'

describe('shouldPrintDevBanner', () => {
  it('skips when --quiet', () => {
    expect(shouldPrintDevBanner(['--quiet'])).toBe(false)
    expect(shouldPrintDevBanner(['-q'])).toBe(false)
  })

  it('prints by default', () => {
    expect(shouldPrintDevBanner([])).toBe(true)
  })
})

describe('printDevBanner', () => {
  it('writes a short banner without throwing', () => {
    const prev = process.env.NO_COLOR
    process.env.NO_COLOR = '1'
    const lines: string[] = []
    const spy = (msg: string) => lines.push(msg)
    const log = console.log
    console.log = spy as typeof console.log
    try {
      printDevBanner()
    } finally {
      console.log = log
      if (prev === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prev
    }
    expect(lines.join('\n').length).toBeLessThan(200)
    expect(lines.join('\n')).toContain('avedon')
  })
})
