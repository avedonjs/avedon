import { describe, expect, it } from 'vitest'
import { shouldSkip } from './shouldSkip.js'

describe('shouldSkip', () => {
  it('lets Vite handle .avedon module requests (not page middleware)', () => {
    expect(shouldSkip('/src/pages/App.avedon')).toBe(true)
    expect(shouldSkip('/src/pages/Home.avedon')).toBe(true)
    expect(shouldSkip('/src/pages/Layout.avedon')).toBe(true)
  })

  it('still serves app routes through middleware', () => {
    expect(shouldSkip('/')).toBe(false)
    expect(shouldSkip('/app')).toBe(false)
    expect(shouldSkip('/about')).toBe(false)
    expect(shouldSkip('/posts/hello')).toBe(false)
  })

  it('skips vite internals and common assets', () => {
    expect(shouldSkip('/@vite/client')).toBe(true)
    expect(shouldSkip('/src/client.ts')).toBe(true)
    expect(shouldSkip('/src/routes.ts')).toBe(true)
    expect(shouldSkip('/favicon.ico')).toBe(true)
  })
})
