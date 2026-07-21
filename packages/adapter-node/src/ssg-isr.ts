import {
  createPathLock,
  isStale,
  matchRoute,
  renderSsgPage,
  type Routes,
} from '@avedon/server'
import { createReadStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const regenLock = createPathLock()

export function ssgHtmlPath(clientDir: string, pathname: string): string {
  return path.join(
    clientDir,
    pathname === '/' ? 'index.html' : path.join(pathname.replace(/^\//, ''), 'index.html'),
  )
}

export type ServeSsgIsrOptions = {
  req: IncomingMessage
  res: ServerResponse
  clientDir: string
  pathname: string
  routes: Routes
  appHtml: string
  clientEntry?: string
}

/**
 * Serve an on-disk SSG page. When the matched route has `revalidate`, stale pages
 * are returned immediately and regenerated in the background (SWR).
 * @returns true if the request was handled (static or ISR).
 */
export function tryServeSsgIsr(opts: ServeSsgIsrOptions): boolean {
  const { req, res, clientDir, pathname, routes, appHtml, clientEntry } = opts
  if (req.method !== 'GET' && req.method !== 'HEAD') return false

  const file = ssgHtmlPath(clientDir, pathname)
  if (!existsSync(file)) return false

  const matched = matchRoute(routes, pathname)
  const leaf = matched?.route
  const isSsg = leaf != null && (leaf.render ?? 'ssr') === 'ssg'
  const revalidate = isSsg ? leaf.revalidate : undefined

  if (revalidate != null && matched) {
    let mtimeMs = 0
    try {
      mtimeMs = statSync(file).mtimeMs
    } catch {
      return false
    }
    if (isStale(mtimeMs, revalidate)) {
      regenLock.run(pathname, async () => {
        const page = await renderSsgPage(routes, pathname, appHtml, { clientEntry })
        if (!page) return
        writeHtmlAtomic(file, page.html)
      })
    }
  }

  res.setHeader('content-type', 'text/html; charset=utf-8')
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  createReadStream(file).pipe(res)
  return true
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
