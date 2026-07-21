/** Out-of-order HTML streaming helpers for SSR. */

export type EnqueueHtml = (html: string) => void

export type BoundaryRender = (
  value: unknown,
  enqueue: EnqueueHtml,
) => void | Promise<void>

export interface RenderStreamController {
  readonly stream: ReadableStream<Uint8Array>
  enqueueHtml(html: string): void
  enqueueBoundary(
    promise: Promise<unknown>,
    thenRender: BoundaryRender,
    catchRender?: BoundaryRender,
    enqueue?: EnqueueHtml,
  ): void
  pipeChildren(children: unknown): Promise<void>
  waitPending(): Promise<void>
  close(): void
  error(err: unknown): void
}

const encoder = new TextEncoder()

export function createRenderStream(): RenderStreamController {
  let idSeq = 0
  const pending: Promise<void>[] = []
  let closed = false
  let ctrl!: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })

  function enqueueHtml(html: string) {
    if (closed || !html) return
    ctrl.enqueue(encoder.encode(html))
  }

  function enqueueBoundary(
    promise: Promise<unknown>,
    thenRender: BoundaryRender,
    catchRender?: BoundaryRender,
    enqueue: EnqueueHtml = enqueueHtml,
  ) {
    const id = `b${++idSeq}`
    enqueue(`<div hidden id="vex-b-${id}"></div>`)

    const task = Promise.resolve(promise).then(
      async (value) => {
        const parts: string[] = []
        await thenRender(value, (h) => {
          if (h) parts.push(h)
        })
        enqueueHtml(oooInjectScript(id, parts.join('')))
      },
      async (err) => {
        const parts: string[] = []
        if (catchRender) {
          await catchRender(err, (h) => {
            if (h) parts.push(h)
          })
        } else {
          parts.push('<!-- vex await error -->')
        }
        enqueueHtml(oooInjectScript(id, parts.join('')))
      },
    ).catch(() => {
      enqueueHtml(oooInjectScript(id, '<!-- vex await error -->'))
    })

    pending.push(task.then(() => undefined))
  }

  async function pipeChildren(children: unknown) {
    if (children == null) return
    if (typeof children === 'function') {
      await (children as (c: RenderStreamController) => Promise<void>)(controller)
      return
    }
    if (typeof children === 'string') {
      enqueueHtml(children)
      return
    }
    if (typeof ReadableStream !== 'undefined' && children instanceof ReadableStream) {
      const decoder = new TextDecoder()
      const reader = (children as ReadableStream<Uint8Array>).getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) enqueueHtml(decoder.decode(value, { stream: true }))
      }
      enqueueHtml(decoder.decode())
      return
    }
    if (isAsyncIterable(children)) {
      for await (const chunk of children) {
        enqueueHtml(String(chunk))
      }
    }
  }

  async function waitPending() {
    while (pending.length) {
      const batch = pending.splice(0, pending.length)
      await Promise.all(batch)
    }
  }

  function close() {
    if (closed) return
    closed = true
    try {
      ctrl.close()
    } catch {
      /* already closed */
    }
  }

  function error(err: unknown) {
    if (closed) return
    closed = true
    try {
      ctrl.error(err)
    } catch {
      /* already closed */
    }
  }

  const controller: RenderStreamController = {
    stream,
    enqueueHtml,
    enqueueBoundary,
    pipeChildren,
    waitPending,
    close,
    error,
  }
  return controller
}

/** Late chunk: JSON payload + script that swaps the placeholder (live parse). */
export function oooInjectScript(id: string, html: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '')
  const json = JSON.stringify(html)
  return (
    `<script type="application/json" id="vex-r-${safe}">${json.replace(/</g, '\\u003c')}</script>` +
    `<script data-vex-stream>(function(){var id=${JSON.stringify(safe)};var b=document.getElementById("vex-b-"+id);var j=document.getElementById("vex-r-"+id);if(!b||!j)return;var t=document.createElement("template");t.innerHTML=JSON.parse(j.textContent||'""');b.replaceWith.apply(b,Array.from(t.content.childNodes));j.remove();var s=document.currentScript;if(s)s.remove();})();</script>`
  )
}

/**
 * Apply OOO payloads without executing scripts (DOMParser / client nav).
 * Idempotent if live scripts already settled the DOM.
 */
export function settleVexStream(root: ParentNode = document) {
  const payloads = root.querySelectorAll('script[type="application/json"][id^="vex-r-"]')
  for (const j of payloads) {
    const id = j.id.slice('vex-r-'.length)
    const b = root.querySelector(`#vex-b-${cssEscape(id)}`)
    if (!b) {
      j.remove()
      continue
    }
    const t = document.createElement('template')
    try {
      t.innerHTML = JSON.parse(j.textContent || '""')
    } catch {
      j.remove()
      continue
    }
    b.replaceWith(...Array.from(t.content.childNodes))
    j.remove()
  }
  root.querySelectorAll('script[data-vex-stream]').forEach((s) => s.remove())
}

function cssEscape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
  return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

export async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder()
  let out = ''
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out
}

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return v != null && typeof (v as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
}
