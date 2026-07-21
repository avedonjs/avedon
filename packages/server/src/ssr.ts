import { escapeHtml } from '@vexjs/runtime'
import type { VexComponentModule } from './types.js'

export function renderShell(
  appHtml: string,
  options: {
    body: string
    head?: string
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
  options: { head?: string; css?: string } = {},
): string {
  const head = [
    options.head ?? '',
    options.css ? `<style data-vex-css>${options.css}</style>` : '',
  ]
    .filter(Boolean)
    .join('\n')

  let html = appHtml
  if (!html.includes('%vex.head%')) {
    html = html.replace('</head>', `${head}\n</head>`)
  } else {
    html = html.replace('%vex.head%', head)
  }

  if (html.includes('%vex.body%')) {
    const idx = html.indexOf('%vex.body%')
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
 * Suffix when app.html uses %vex.body% or default #app:
 * everything after the body insertion point, with afterApp before </body>.
 */
export function renderShellSuffixFromTemplate(
  appHtml: string,
  options: { props?: Record<string, unknown>; clientEntry?: string } = {},
): string {
  const payload = `<script type="application/json" id="__VEX_DATA__">${JSON.stringify(options.props ?? {}).replace(/</g, '\\u003c')}</script>`
  const client =
    options.clientEntry
      ? `<script type="module" src="${escapeHtml(options.clientEntry)}"></script>`
      : ''
  const afterApp = [payload, client].filter(Boolean).join('\n')

  if (appHtml.includes('%vex.body%')) {
    let tail = appHtml.slice(appHtml.indexOf('%vex.body%') + '%vex.body%'.length)
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
  mod: VexComponentModule | (() => Promise<VexComponentModule>) | null | undefined,
): Promise<VexComponentModule> {
  if (mod == null) {
    throw new Error('Route component is undefined')
  }
  const resolved = typeof mod === 'function' ? await mod() : mod
  if (resolved == null) {
    throw new Error('Route component resolved to undefined')
  }
  return (resolved as VexComponentModule).default ?? resolved
}
