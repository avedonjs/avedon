/**
 * Web Worker: runs @avedon/compiler's compile() off the main thread.
 * The main thread sends { type: 'compile', id, source } messages.
 * The worker replies with { type: 'result', id, code, css } or { type: 'error', id, message }.
 *
 * Server scripts are taken from parse() (linear tag scan — not regex sanitization).
 * Client compile uses a rebuilt source without <script server>: compiling the raw
 * file (server block included) can throw `useCaseSensitiveFileNames` in the
 * browser worker's bundled TypeScript transpile path.
 */

import { compile, parse } from '@avedon/compiler'

self.addEventListener('message', (event: MessageEvent) => {
  const { type, id, source } = event.data as {
    type: string
    id: number
    source: string
  }
  if (type !== 'compile') return

  try {
    const parsed = parse(source)
    const parts: string[] = []
    if (parsed.clientScript.trim()) {
      parts.push(`<script lang="${parsed.scriptLang}">\n${parsed.clientScript}\n</script>`)
    }
    if (parsed.style.trim()) {
      const attrs = parsed.scoped ? '' : ' unscoped'
      parts.push(`<style${attrs}>\n${parsed.style}\n</style>`)
    }
    if (parsed.markup.trim()) {
      parts.push(parsed.markup)
    }
    const { code, css } = compile(parts.join('\n\n'), {
      filename: 'Playground.ave',
      generate: 'client',
    })
    self.postMessage({ type: 'result', id, code, css, serverScript: parsed.serverScript })
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
})
