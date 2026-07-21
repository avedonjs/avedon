import { describe, expect, it } from 'vitest'
import { createHandler } from './pipeline.js'
import { redirect, notFound } from './errors.js'

const appHtml =
  '<!doctype html><html><head></head><body><div id="app">%avedon.body%</div></body></html>'

describe('SSR streaming TTFB', () => {
  it('flushes document shell before slow renderInto finishes', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/slow',
          component: {
            render: () => '<p>sync</p>',
            async renderInto(ctrl) {
              ctrl.enqueueHtml('<p>early</p>')
              await new Promise((r) => setTimeout(r, 200))
              ctrl.enqueueHtml('<p>late</p>')
            },
          },
        },
      ],
    })

    const res = await handler(new Request('http://localhost/slow'))
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    const first = await reader.read()
    const chunk1 = decoder.decode(first.value!)
    expect(chunk1).toContain('<html')
    expect(chunk1).not.toContain('<p>late</p>')

    let all = chunk1
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      all += decoder.decode(value!)
    }
    expect(all).toContain('<p>early</p>')
    expect(all).toContain('<p>late</p>')
  })

  it('returns HTTP redirect when load throws redirect before shell flush window', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/go',
          component: {
            render: () => '<p>nope</p>',
            load() {
              redirect('/done')
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/go'))
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/done')
  })

  it('injects client redirect when load throws redirect after shell flush window', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/slow-go',
          component: {
            render: () => '<p>nope</p>',
            async load() {
              await new Promise((r) => setTimeout(r, 80))
              redirect('/done')
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/slow-go'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('window.location.href')
    expect(text).toContain('/done')
    expect(text).toContain('</html>')
  })

  it('renders notFound UI in stream when load throws after shell flush window', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/slow-nf',
          notFound: { render: () => '<p id="nf">missing</p>' },
          component: {
            render: () => '<p>page</p>',
            async load() {
              await new Promise((r) => setTimeout(r, 80))
              throw notFound()
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/slow-nf'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('id="nf"')
    expect(text).toContain('</html>')
  })
})
