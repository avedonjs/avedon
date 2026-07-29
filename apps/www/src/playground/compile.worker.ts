/**
 * Web Worker: runs @avedon/compiler's compile() off the main thread.
 * The main thread sends { type: 'compile', id, source } messages.
 * The worker replies with { type: 'result', id, code, css } or { type: 'error', id, message }.
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
    // compile() already excludes <script server> from the client bundle via parse().
    const { serverScript } = parse(source)
    const { code, css } = compile(source, {
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
