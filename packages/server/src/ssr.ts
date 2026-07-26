import { escapeHtml } from '@avedon/runtime'
import type { HeadMeta } from '@avedon/shared'
import type { AvedonComponentModule } from './types.js'

export function renderShell(
  appHtml: string,
  options: {
    body: string
    head?: HeadMeta
    css?: string
    props?: Record<string, unknown>
    clientEntry?: string
  },
): string {
  return (
    renderShellPrefix(appHtml, { head: options.head, css: options.css }) +
    options.body +
    renderShellSuffixFromTemplate(appHtml, {
      props: options.props,
      clientEntry: options.clientEntry,
    })
  )
}

/** HTML through opening `<div id="app">` (body not closed). */
export function renderShellPrefix(
  appHtml: string,
  options: { head?: HeadMeta; css?: string } = {},
): string {
  let html = appHtml
  const extra: string[] = []

  if (options.head) {
    const applied = applyHead(html, options.head)
    html = applied.html
    extra.push(...applied.extra)
  }
  if (options.css) extra.push(`<style data-avedon-css>${options.css}</style>`)

  const head = extra.filter(Boolean).join('\n')

  if (!html.includes('%avedon.head%')) {
    html = html.replace('</head>', `${head}\n</head>`)
  } else {
    html = html.replace('%avedon.head%', head)
  }

  if (html.includes('%avedon.body%')) {
    const idx = html.indexOf('%avedon.body%')
    return html.slice(0, idx)
  }

  const appOpen = '<div id="app">'
  const appIdx = html.indexOf(appOpen)
  if (appIdx >= 0) {
    return html.slice(0, appIdx + appOpen.length)
  }

  // Fallback: insert before </body>
  const bodyClose = html.lastIndexOf('</body>')
  if (bodyClose >= 0) {
    return html.slice(0, bodyClose) + appOpen
  }
  return html + appOpen
}

/**
 * Replace the first `<title>…</title>` (case-insensitive) via linear scanning.
 * Avoids backtracking regexes (ReDoS-safe) on the app.html template.
 */
function replaceTitle(html: string, replacement: string): string | null {
  const lower = html.toLowerCase()
  const open = lower.indexOf('<title>')
  if (open < 0) return null
  const close = lower.indexOf('</title>', open + 7)
  if (close < 0) return null
  return html.slice(0, open) + replacement + html.slice(close + '</title>'.length)
}

/**
 * Replace the first `<meta name="description" …>` tag via linear scanning.
 * Avoids backtracking regexes (ReDoS-safe) on the app.html template.
 */
function replaceDescriptionMeta(html: string, replacement: string): string | null {
  const lower = html.toLowerCase()
  let from = 0
  for (;;) {
    const tagStart = lower.indexOf('<meta', from)
    if (tagStart < 0) return null
    const tagEnd = html.indexOf('>', tagStart)
    if (tagEnd < 0) return null
    const tag = lower.slice(tagStart, tagEnd)
    if (/\bname\s*=\s*["']description["']/.test(tag)) {
      return html.slice(0, tagStart) + replacement + html.slice(tagEnd + 1)
    }
    from = tagEnd + 1
  }
}

/** Replace title / description in the template when present; return leftovers to append. */
function applyHead(appHtml: string, head: HeadMeta): { html: string; extra: string[] } {
  let html = appHtml
  const extra: string[] = []

  if (head.title != null) {
    const tag = `<title>${escapeHtml(head.title)}</title>`
    const replaced = replaceTitle(html, tag)
    if (replaced != null) html = replaced
    else extra.push(tag)
  }

  if (head.description != null) {
    const tag = `<meta name="description" content="${escapeHtml(head.description)}" />`
    const replaced = replaceDescriptionMeta(html, tag)
    if (replaced != null) html = replaced
    else extra.push(tag)
  }

  if (head.html) extra.push(head.html)
  return { html, extra }
}

/** Close `#app`, hydration payload, client entry, and document end (simple templates). */
export function renderShellSuffix(options: {
  props?: Record<string, unknown>
  clientEntry?: string
} = {}): string {
  return renderShellSuffixFromTemplate(
    '<!doctype html><html><head></head><body><div id="app"></div></body></html>',
    options,
  )
}

/**
 * Suffix when app.html uses %avedon.body% or default #app:
 * everything after the body insertion point, with afterApp before </body>.
 */
export function renderShellSuffixFromTemplate(
  appHtml: string,
  options: { props?: Record<string, unknown>; clientEntry?: string } = {},
): string {
  const payload = `<script type="application/json" id="__AVEDON_DATA__">${JSON.stringify(options.props ?? {}).replace(/</g, '\\u003c')}</script>`
  const client =
    options.clientEntry
      ? `<script type="module" src="${escapeHtml(options.clientEntry)}"></script>`
      : ''
  const afterApp = [payload, client].filter(Boolean).join('\n')

  if (appHtml.includes('%avedon.body%')) {
    let tail = appHtml.slice(appHtml.indexOf('%avedon.body%') + '%avedon.body%'.length)
    if (afterApp) {
      if (tail.includes('</body>')) {
        tail = tail.replace('</body>', `${afterApp}\n</body>`)
      } else {
        tail = afterApp + tail
      }
    }
    return tail
  }

  // Default app.html shape: close #app then remaining after `</div>` of #app
  const appOpen = '<div id="app">'
  const appIdx = appHtml.indexOf(appOpen)
  if (appIdx >= 0) {
    const afterOpen = appHtml.slice(appIdx + appOpen.length)
    // afterOpen starts with `</div>...` — drop the empty close and rebuild
    const closed = afterOpen.replace(/^\s*<\/div>/, '')
    return `</div>\n${afterApp}${closed.startsWith('\n') ? '' : '\n'}${closed}`
  }

  return `</div>\n${afterApp}\n</body></html>`
}

export async function resolveComponent(
  mod: AvedonComponentModule | (() => Promise<AvedonComponentModule>) | null | undefined,
): Promise<AvedonComponentModule> {
  if (mod == null) {
    throw new Error('Route component is undefined')
  }
  const resolved = typeof mod === 'function' ? await mod() : mod
  if (resolved == null) {
    throw new Error('Route component resolved to undefined')
  }
  return (resolved as AvedonComponentModule).default ?? resolved
}
