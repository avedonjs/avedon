import CompileWorker from './compile.worker.ts?worker'
import MockServerWorker from './mock-server.worker.ts?worker'

const RUNTIME_MODULE = '/playground-runtime.js'

export type RunResult = { error?: string }

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------

type WorkerReply =
  | { type: 'result'; id: number; code: string; css: string; serverScript: string }
  | { type: 'error'; id: number; message: string }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (r: WorkerReply) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new CompileWorker()
    worker.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
      const reply = event.data
      const entry = pending.get(reply.id)
      if (entry) {
        pending.delete(reply.id)
        entry.resolve(reply)
      }
    })
    worker.addEventListener('error', (event) => {
      // Surface worker init/parse errors to all waiting callers.
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.resolve({ type: 'error', id, message: event.message ?? 'Worker error' })
      }
    })
  }
  return worker
}

function compileInWorker(source: string): Promise<WorkerReply> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, { resolve })
    getWorker().postMessage({ type: 'compile', id, source })
  })
}

// ---------------------------------------------------------------------------
// Mock server worker (isolates AsyncFunction eval off the docs page origin)
// ---------------------------------------------------------------------------

type MockReply =
  | { type: 'ready'; id: number; props: Record<string, unknown> }
  | { type: 'action-result'; id: number; result: unknown }
  | { type: 'error'; id: number; message: string }

let mockWorker: Worker | null = null
let mockNextId = 0
const mockPending = new Map<number, { resolve: (r: MockReply) => void; reject: (e: Error) => void }>()

function getMockWorker(): Worker {
  if (!mockWorker) {
    mockWorker = new MockServerWorker()
    mockWorker.addEventListener('message', (event: MessageEvent<MockReply>) => {
      const reply = event.data
      const entry = mockPending.get(reply.id)
      if (entry) {
        mockPending.delete(reply.id)
        entry.resolve(reply)
      }
    })
    mockWorker.addEventListener('error', (event) => {
      for (const [id, entry] of mockPending) {
        mockPending.delete(id)
        entry.reject(new Error(event.message ?? 'Mock worker error'))
      }
    })
  }
  return mockWorker
}

function mockRequest(msg: {
  id: number
  type: string
  serverScript?: string
  action?: string
  fields?: [string, FormDataEntryValue][]
}): Promise<MockReply> {
  return new Promise((resolve, reject) => {
    mockPending.set(msg.id, { resolve, reject })
    getMockWorker().postMessage(msg)
  })
}

async function initMockServer(serverScript: string): Promise<Record<string, unknown>> {
  const id = mockNextId++
  const reply = await mockRequest({ type: 'init', id, serverScript })
  if (reply.type === 'error') throw new Error(reply.message)
  if (reply.type !== 'ready') throw new Error('Unexpected mock worker reply')
  return reply.props
}

async function runMockAction(
  action: string,
  fields: [string, FormDataEntryValue][],
): Promise<unknown> {
  const id = mockNextId++
  const reply = await mockRequest({ type: 'action', id, action, fields })
  if (reply.type === 'error') throw new Error(reply.message)
  if (reply.type !== 'action-result') throw new Error('Unexpected mock worker reply')
  return reply.result
}

// ---------------------------------------------------------------------------
// Runtime data-URL helpers
// ---------------------------------------------------------------------------

function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function runtimeModuleDataUrl(): Promise<string> {
  const runtimeUrl = new URL(RUNTIME_MODULE, window.location.origin).href
  const res = await fetch(runtimeUrl, { cache: 'no-store' })
  const text = await res.text()
  return `data:text/javascript;base64,${toBase64Utf8(text)}`
}

// ---------------------------------------------------------------------------
// iframe HTML builder
// ---------------------------------------------------------------------------

function buildIframeHtml(opts: {
  moduleCode: string
  css: string
  props: Record<string, unknown>
  wireActions: boolean
  runtimeUrl: string
}): string {
  const propsJson = JSON.stringify(opts.props)
  const css = opts.css.replace(/<\/style/gi, '<\\/style')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #09090b;
    color: #fafafa;
    font-family: system-ui, sans-serif;
    padding: 1rem;
    box-sizing: border-box;
  }
  * { box-sizing: border-box; }
</style>
<style type="text/tailwindcss">
  @theme {
    --color-bg: #09090B;
    --color-fg: #FAFAFA;
    --color-muted: #A1A1AA;
    --color-accent: #06B6D4;
    --color-accent-deep: #0891B2;
    --color-line: rgba(250, 250, 250, 0.12);
  }
  .primary {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
<script src="/playground-tailwind.js"></script>
<style id="pg-css">${css}</style>
<script type="importmap">
${JSON.stringify({ imports: { '@avedon/runtime': opts.runtimeUrl } }, null, 2)}
</script>
</head>
<body>
<div id="app"></div>
<script type="module">
const moduleCode = ${JSON.stringify(opts.moduleCode)};
const props = ${propsJson};
const wireActions = ${opts.wireActions ? 'true' : 'false'};
try {
  const blobUrl = URL.createObjectURL(new Blob([moduleCode], { type: 'text/javascript' }));
  const mod = await import(blobUrl);
  URL.revokeObjectURL(blobUrl);
  const root = document.getElementById('app');
  mod.mount(root, props);
  if (wireActions) {
    document.addEventListener(
      'submit',
      (event) => {
        if (event.defaultPrevented) return;
        const form = event.target?.closest?.('form');
        if (!form) return;
        const actionAttr = form.getAttribute('action') || '';
        const url = new URL(actionAttr, 'http://playground.local/');
        const action = url.searchParams.get('_action');
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const fd = new FormData(form);
        // Sandboxed preview has an opaque origin ("null"); targetOrigin must be '*'
        // or the parent never receives the message.
        parent.postMessage({ type: 'avedon-pg-action', action, fields: [...fd.entries()] }, '*');
      },
      true,
    );

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        const btn = target?.closest?.('button[type="submit"], button:not([type])');
        if (!btn) return;
        const form = btn.closest?.('form');
        if (!form) return;
        if (btn.getAttribute('disabled') != null) return;

        const actionAttr = form.getAttribute('action') || '';
        const url = new URL(actionAttr, 'http://playground.local/');
        const action = url.searchParams.get('_action');
        if (!action) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        const fd = new FormData(form);
        parent.postMessage({ type: 'avedon-pg-action', action, fields: [...fd.entries()] }, '*');
      },
      true,
    );
  }
  parent.postMessage({ type: 'avedon-pg-ready' }, '*');
} catch (err) {
  parent.postMessage({ type: 'avedon-pg-error', message: String(err) }, '*');
}
</script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// PlaygroundRunner
// ---------------------------------------------------------------------------

export class PlaygroundRunner {
  private iframe: HTMLIFrameElement | null = null
  private mockProps: Record<string, unknown> | null = null
  private mockReady = false
  private source = ''
  private compiled: { code: string; css: string; serverScript: string } | null = null
  private onMessage: ((event: MessageEvent) => void) | null = null
  private runtimeUrl: string | null = null

  attach(iframe: HTMLIFrameElement) {
    this.detach()
    this.iframe = iframe
    this.onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'avedon-pg-action') {
        void this.handleAction(String(data.action ?? ''), data.fields as [string, FormDataEntryValue][])
      }
    }
    window.addEventListener('message', this.onMessage)
  }

  detach() {
    if (this.onMessage) window.removeEventListener('message', this.onMessage)
    this.onMessage = null
    this.iframe = null
    this.mockProps = null
    this.mockReady = false
    this.compiled = null
    this.source = ''
  }

  async run(
    source: string,
    overrideProps?: Record<string, unknown>,
    opts?: { refreshOnly?: boolean },
  ): Promise<RunResult> {
    if (!this.iframe) return { error: 'Preview not attached' }

    const sourceChanged = source !== this.source
    this.source = source

    try {
      if (!opts?.refreshOnly) {
        if (sourceChanged || !this.compiled) {
          const reply = await compileInWorker(source)
          if (reply.type === 'error') return { error: reply.message }
          this.compiled = {
            code: reply.code,
            css: reply.css,
            serverScript: reply.serverScript,
          }
        }

        if (sourceChanged || !this.mockReady) {
          this.mockProps = await initMockServer(this.compiled!.serverScript)
          this.mockReady = true
        }
      }

      if (!this.compiled) return { error: 'Preview not compiled' }

      const props = overrideProps ?? this.mockProps ?? {}
      if (!this.runtimeUrl) this.runtimeUrl = await runtimeModuleDataUrl()
      this.iframe.srcdoc = buildIframeHtml({
        moduleCode: this.compiled.code,
        css: this.compiled.css,
        props,
        wireActions: true,
        runtimeUrl: this.runtimeUrl,
      })
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }

  private async handleAction(action: string, fields: [string, FormDataEntryValue][]) {
    if (!this.mockReady) return
    const res = await runMockAction(action, fields)
    if (res && typeof res === 'object' && 'data' in res) {
      await this.run(this.source, { data: (res as { data: unknown }).data }, { refreshOnly: true })
    }
  }
}
