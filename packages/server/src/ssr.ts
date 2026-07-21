import { escapeHtml } from '@vexjs/runtime'
import type { VexComponentModule } from './types.js'

export function renderShell(appHtml: string, options: {
  body: string
  head?: string
  css?: string
  props?: Record<string, unknown>
  clientEntry?: string
}): string {
  const head = [
    options.head ?? '',
    options.css ? `<style data-vex-css>${options.css}</style>` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const payload = `<script type="application/json" id="__VEX_DATA__">${JSON.stringify(options.props ?? {}).replace(/</g, '\\u003c')}</script>`
  const client =
    options.clientEntry
      ? `<script type="module" src="${escapeHtml(options.clientEntry)}"></script>`
      : ''

  let html = appHtml
  if (!html.includes('%vex.head%')) {
    html = html.replace('</head>', `${head}\n</head>`)
  } else {
    html = html.replace('%vex.head%', head)
  }
  // Keep __VEX_DATA__ + client entry outside #app so leaf mount/destroy
  // cannot wipe them during client navigations.
  const afterApp = [payload, client].filter(Boolean).join('\n')
  if (!html.includes('%vex.body%')) {
    html = html.replace(
      '<div id="app"></div>',
      `<div id="app">${options.body}</div>\n${afterApp}`,
    )
    if (!html.includes('id="app"')) {
      html = html.replace(
        '</body>',
        `<div id="app">${options.body}</div>\n${afterApp}\n</body>`,
      )
    }
  } else {
    html = html.replace('%vex.body%', options.body)
    if (afterApp) {
      html = html.replace('</body>', `${afterApp}\n</body>`)
    }
  }
  return html
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
