import { describe, expect, it } from 'vitest'

/** Mirrors form action resolution in enhance(). */
function resolveFormAction(action: string | null, pageHref: string): string {
  const url = new URL(action == null || action === '' ? pageHref : action, pageHref)
  return url.pathname + url.search
}

describe('form action resolution', () => {
  it('keeps query-only action on the current path', () => {
    expect(resolveFormAction('?_action=like', 'http://localhost:5173/posts/1')).toBe(
      '/posts/1?_action=like',
    )
  })

  it('does not collapse to / when base is origin-only (regression)', () => {
    // Wrong: new URL('?_action=like', 'http://localhost:5173') → /
    const wrong = new URL('?_action=like', 'http://localhost:5173')
    expect(wrong.pathname).toBe('/')
    expect(resolveFormAction('?_action=like', 'http://localhost:5173/posts/1')).not.toBe(
      '/?_action=like',
    )
  })
})
