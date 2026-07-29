/**
 * Web Worker: runs @avedon/compiler's compile() off the main thread.
 * The main thread sends { type: 'compile', id, source } messages.
 * The worker replies with { type: 'result', id, code, css } or { type: 'error', id, message }.
 */

import { compile } from '@avedon/compiler'

function extractServerScript(source: string): string {
  const re = /<script\s+server\b[^>]*>([\s\S]*?)<\/script>/gi
  const parts: string[] = []
  for (;;) {
    const m = re.exec(source)
    if (!m) break
    parts.push(m[1] ?? '')
  }
  return parts.join('\n').trim()
}

function stripServerScriptBlocks(source: string): string {
  const re = /<script\s+server\b[^>]*>[\s\S]*?<\/script>/gi
  return source.replace(re, '').trim()
}

self.addEventListener('message', (event: MessageEvent) => {
  const { type, id, source } = event.data as {
    type: string
    id: number
    source: string
  }
  if (type !== 'compile') return

  try {
    const serverScript = extractServerScript(source)
    const clientSource = stripServerScriptBlocks(source)
    const { code, css } = compile(clientSource, {
      filename: 'Playground.ave',
      generate: 'client',
    })
    self.postMessage({ type: 'result', id, code, css, serverScript })
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
})
