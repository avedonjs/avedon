import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveUnderRoot, ssgHtmlPathSafe } from './safe-path.js'

describe('resolveUnderRoot', () => {
  const root = path.resolve('/tmp/avedon-client')

  it('resolves files inside the root', () => {
    expect(resolveUnderRoot(root, '/assets/app.js')).toBe(path.join(root, 'assets', 'app.js'))
    expect(resolveUnderRoot(root, 'assets/app.js')).toBe(path.join(root, 'assets', 'app.js'))
  })

  it('rejects path traversal', () => {
    expect(resolveUnderRoot(root, '/../../../etc/passwd')).toBeNull()
    expect(resolveUnderRoot(root, '../../etc/passwd')).toBeNull()
    expect(resolveUnderRoot(root, '/assets/../../etc/passwd')).toBeNull()
  })

  it('maps absolute-looking URL paths under the client root (no path.join reset)', () => {
    // Without stripping the leading slash, path.join(root, '/etc/passwd') → /etc/passwd
    expect(resolveUnderRoot(root, '/etc/passwd')).toBe(path.join(root, 'etc', 'passwd'))
  })

  it('rejects null bytes', () => {
    expect(resolveUnderRoot(root, '/assets/\0secret')).toBeNull()
  })

  it('rejects URL-encoded and double-encoded traversal', () => {
    expect(resolveUnderRoot(root, '/..%2f..%2f..%2fetc%2fpasswd')).toBeNull()
    expect(resolveUnderRoot(root, '/..%252f..%252f..%252fetc%252fpasswd')).toBeNull()
  })

  it('rejects backslash / Windows-style traversal', () => {
    expect(resolveUnderRoot(root, '/..\\/..\\/etc/passwd')).toBeNull()
    expect(resolveUnderRoot(root, '/..%5c..%5c..%5cetc%5cpasswd')).toBeNull()
  })
})

describe('ssgHtmlPathSafe', () => {
  const root = path.resolve('/tmp/avedon-client')

  it('maps / to index.html', () => {
    expect(ssgHtmlPathSafe(root, '/')).toBe(path.join(root, 'index.html'))
  })

  it('maps nested routes', () => {
    expect(ssgHtmlPathSafe(root, '/docs/intro')).toBe(
      path.join(root, 'docs', 'intro', 'index.html'),
    )
  })

  it('rejects traversal in SSG paths', () => {
    expect(ssgHtmlPathSafe(root, '/../../etc/passwd')).toBeNull()
  })
})
