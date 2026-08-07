/// <reference lib="webworker" />
import { evalMockServer, type MockServer } from './mock-server.js'

let mock: MockServer | null = null

type InMsg =
  | { type: 'init'; id: number; serverScript: string }
  | {
      type: 'action'
      id: number
      action: string
      fields: [string, FormDataEntryValue][]
    }

type OutMsg =
  | { type: 'ready'; id: number; props: Record<string, unknown> }
  | { type: 'action-result'; id: number; result: unknown }
  | { type: 'error'; id: number; message: string }

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  try {
    if (msg.type === 'init') {
      mock = await evalMockServer(msg.serverScript)
      const out: OutMsg = { type: 'ready', id: msg.id, props: mock.props }
      self.postMessage(out)
      return
    }
    if (msg.type === 'action') {
      if (!mock?.actions?.[msg.action]) {
        const out: OutMsg = { type: 'action-result', id: msg.id, result: null }
        self.postMessage(out)
        return
      }
      const fd = new FormData()
      for (const [k, v] of msg.fields) fd.append(k, v)
      const result = await mock.actions[msg.action]!({
        params: {},
        request: { formData: async () => fd },
      })
      const out: OutMsg = { type: 'action-result', id: msg.id, result }
      self.postMessage(out)
    }
  } catch (err) {
    const out: OutMsg = {
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(out)
  }
}
