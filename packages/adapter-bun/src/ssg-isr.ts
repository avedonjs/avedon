import {
  createPathLock,
  isStale,
  matchRoute,
  renderSsgPage,
  type Routes,
} from '@avedon/server'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ssgHtmlPathSafe } from './safe-path.js'

const regenLock = createPathLock()

export function ssgHtmlPath(clientDir: string, pathname: string): string {
  const safe = ssgHtmlPathSafe(clientDir, pathname)
  if (!safe) {
    throw new Error(`Refusing path outside client dir: ${pathname}`)
  }
  return safe
}

export type ServeSsgIsrBunOptions = {
  request: Request
  clientDir: string
  pathname: string
  routes: Routes
  appHtml: string
  clientEntry?: string
}

/**
 * Serve an on-disk SSG page as a Web Response. When the matched route has
 * `revalidate`, stale pages are returned immediately and regenerated in the
 * background (SWR).
 * @returns Response if handled, otherwise null.
 */
export function tryServeSsgIsrBun(opts: ServeSsgIsrBunOptions): Response | null {
  const { request, clientDir, pathname, routes, appHtml, clientEntry } = opts
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return null

  const file = ssgHtmlPathSafe(clientDir, pathname)
  if (!file || !existsSync(file)) return null

  const matched = matchRoute(routes, pathname)
  const leaf = matched?.route
  const isSsg = leaf != null && (leaf.render ?? 'ssr') === 'ssg'
  const revalidate = isSsg ? leaf.revalidate : undefined

  if (revalidate != null && matched) {
    let mtimeMs = 0
    try {
      mtimeMs = statSync(file).mtimeMs
    } catch {
      return null
    }
    if (isStale(mtimeMs, revalidate)) {
      regenLock.run(pathname, async () => {
        const page = await renderSsgPage(routes, pathname, appHtml, { clientEntry })
        if (!page) return
        writeHtmlAtomic(file, page.html)
      })
    }
  }

  const headers = { 'content-type': 'text/html; charset=utf-8' }
  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }
  const html = readFileSync(file, 'utf8')
  return new Response(html, { status: 200, headers })
}

export function writeHtmlAtomic(file: string, html: string): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(tmp, html, 'utf8')
  renameSync(tmp, file)
}

/** Test helper: whether a pathname is currently regenerating. */
export function isRegenerating(pathname: string): boolean {
  return regenLock.has(pathname)
}
