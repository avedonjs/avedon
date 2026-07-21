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
    while (!early.includes('</main>') || !early.includes('avedon-b-')) {
      const c = await readOne()
      if (c == null) break
      early += c
    }
    expect(early).toContain('id="avedon-b-b1"')
    expect(early).toContain('</main>')
    expect(early).not.toContain('avedon-r-b1')

    resolve('done')
    await ctrl.waitPending()
    ctrl.close()

    let rest = ''
    for (;;) {
      const c = await readOne()
      if (c == null) break
      rest += c
    }
    expect(rest).toContain('avedon-r-b1')
    expect(rest).toContain('<template id="avedon-r-b1">')
    expect(rest).toContain('<p>done</p>')
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
  it('embeds html in a template payload with stream script', () => {
    const chunk = oooInjectScript('b1', '<span>ok</span>')
    expect(chunk).toContain('<template id="avedon-r-b1">')
    expect(chunk).toContain('<span>ok</span>')
    expect(chunk).toContain('data-avedon-stream')
    expect(chunk).toContain('t.content.childNodes')
  })

  it('escapes nested </template> so the wrapper stays intact', () => {
    const chunk = oooInjectScript('b1', '<div></template></div>')
    expect(chunk).toContain('<\\/template>')
    expect(chunk.startsWith('<template id="avedon-r-b1">')).toBe(true)
    expect(chunk).toMatch(/<\/template><script data-avedon-stream>/)
  })
})
