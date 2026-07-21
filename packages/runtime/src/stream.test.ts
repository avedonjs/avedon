import { describe, expect, it } from 'vitest'
import {
  createRenderStream,
  oooInjectScript,
  streamToString,
} from './stream.js'

describe('createRenderStream', () => {
  it('enqueues html chunks', async () => {
    const ctrl = createRenderStream()
    ctrl.enqueueHtml('<h1>')
    ctrl.enqueueHtml('Hi')
    ctrl.enqueueHtml('</h1>')
    ctrl.close()
    expect(await streamToString(ctrl.stream)).toBe('<h1>Hi</h1>')
  })

  it('out-of-order await: placeholder before inject', async () => {
    const ctrl = createRenderStream()
    let resolve!: (v: string) => void
    const p = new Promise<string>((r) => {
      resolve = r
    })
    ctrl.enqueueHtml('<main>')
    ctrl.enqueueBoundary(p, (value, enqueue) => {
      enqueue(`<p>${value}</p>`)
    })
    ctrl.enqueueHtml('</main>')

    const reader = ctrl.stream.getReader()
    const decoder = new TextDecoder()
    const readOne = async () => {
      const { done, value } = await reader.read()
      if (done) return null
      return decoder.decode(value)
    }

    let early = ''
    while (!early.includes('</main>') || !early.includes('vex-b-')) {
      const c = await readOne()
      if (c == null) break
      early += c
    }
    expect(early).toContain('id="vex-b-b1"')
    expect(early).toContain('</main>')
    expect(early).not.toContain('vex-r-b1')

    resolve('done')
    await ctrl.waitPending()
    ctrl.close()

    let rest = ''
    for (;;) {
      const c = await readOne()
      if (c == null) break
      rest += c
    }
    expect(rest).toContain('vex-r-b1')
    expect(rest).toContain('\\u003cp>done\\u003c/p>')
  })

  it('pipeChildren accepts writer function', async () => {
    const ctrl = createRenderStream()
    await ctrl.pipeChildren(async (c) => {
      c.enqueueHtml('<child/>')
    })
    ctrl.close()
    expect(await streamToString(ctrl.stream)).toBe('<child/>')
  })
})

describe('oooInjectScript', () => {
  it('embeds html as JSON payload with stream script', () => {
    const chunk = oooInjectScript('b1', '<span>ok</span>')
    expect(chunk).toContain('id="vex-r-b1"')
    expect(chunk).toContain('data-vex-stream')
    expect(chunk).toContain('\\u003cspan>ok\\u003c/span>')
  })
})
