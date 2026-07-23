import path from 'node:path'

/**
 * Decode percent-encoding repeatedly (caps runaway input) so double-encoded
 * separators like `%252f` cannot bypass traversal checks.
 */
function fullyDecode(pathname: string): string | null {
  let decoded = pathname
  for (let i = 0; i < 8; i++) {
    if (decoded.includes('\0')) return null
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      return null
    }
    if (next === decoded) return decoded
    decoded = next
  }
  return null
}

/**
 * Resolve `pathname` under `root`, rejecting traversal and absolute escapes.
 * Returns null when the resolved path would leave `root`.
 *
 * Pass the raw request path (before WHATWG URL normalization) so literal
 * `..` segments are still visible to this check.
 */
export function resolveUnderRoot(root: string, pathname: string): string | null {
  if (pathname.includes('\0')) return null
  const decoded = fullyDecode(pathname)
  if (decoded == null || decoded.includes('\0')) return null

  const rootResolved = path.resolve(root)
  const rel =
    decoded === '/' || decoded === ''
      ? ''
      : decoded.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  // Absolute segments (e.g. "/etc/passwd") must not reset path.join
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null

  const resolved = rel ? path.resolve(rootResolved, rel) : rootResolved
  const relative = path.relative(rootResolved, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return resolved
}

/** HTML file path for an SSG pathname, or null if outside clientDir. */
export function ssgHtmlPathSafe(clientDir: string, pathname: string): string | null {
  const rel =
    pathname === '/' || pathname === ''
      ? 'index.html'
      : path.join(pathname.replace(/^[/\\]+/, ''), 'index.html')
  return resolveUnderRoot(clientDir, rel)
}
