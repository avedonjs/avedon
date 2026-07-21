import { describe, expect, it } from 'vitest'
import { createHandler } from './pipeline.js'

const appHtml = '<!doctype html><html><head></head><body><div id="app"></div></body></html>'

describe('createHandler', () => {
  it('runs load and renders ssr', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          component: {
            async load() {
              return { title: 'Hello' }
            },
            render(props = {}) {
              return `<h1>${props.title}</h1>`
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/'))
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('dispatches absolute api routes', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          component: {
            render: () => '',
            api: {
              'GET /api/items': async () => Response.json({ items: [1] }),
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/api/items'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [1] })
  })

  it('merges named action result into props', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          component: {
            render(props = {}) {
              return `<p>${props.saved}</p>`
            },
            actions: {
              save: async ({ formData }) => ({ saved: String(formData.get('q') ?? '') }),
            },
          },
        },
      ],
    })
    const body = new URLSearchParams({ q: 'note' })
    const res = await handler(
      new Request('http://localhost/?/save', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      }),
    )
    expect(await res.text()).toContain('<p>note</p>')
  })

  it('wraps page with layout slot children', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          layout: {
            render(props = {}) {
              return `<div class="layout">${props.children}</div>`
            },
          },
          component: {
            render: () => `<main>Home</main>`,
          },
        },
      ],
    })
    const html = await (await handler(new Request('http://localhost/'))).text()
    // Page outlet keeps layout intact when the client hydrates the leaf only
    expect(html).toContain('<div class="layout"><div data-vex-page><main>Home</main></div></div>')
  })

  it('ssr page content is wrapped in data-vex-page for layout-safe hydrate', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          component: { render: () => `<h1>Hi</h1>` },
        },
      ],
    })
    const html = await (await handler(new Request('http://localhost/'))).text()
    expect(html).toContain('<div data-vex-page><h1>Hi</h1></div>')
  })

  it('uses route-level error on failed canActivate', async () => {
    const handler = createHandler({
      appHtml,
      errorComponent: {
        render: () => `<p>global</p>`,
      },
      routes: [
        {
          path: '/secret',
          canActivate: () => false,
          error: {
            render(props = {}) {
              return `<p>route-${props.status}</p>`
            },
          },
          component: { render: () => 'nope' },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/secret'))
    expect(res.status).toBe(403)
    const html = await res.text()
    expect(html).toContain('route-403')
    expect(html).toContain('data-vex-page')
  })

  it('supports guard alias and _action query', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/x',
          guard: () => true,
          component: {
            render: (p = {}) => `<p>${p.n ?? 0}</p>`,
            actions: {
              bump: async () => ({ n: 2 }),
            },
          },
        },
      ],
    })
    const res = await handler(
      new Request('http://localhost/x?_action=bump', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: '',
      }),
    )
    expect(await res.text()).toContain('<p>2</p>')
  })

  it('serves api_GET via .json suffix', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/posts/:id',
          component: {
            render: () => '',
            async api_GET({ params }) {
              return Response.json({ id: params.id })
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/posts/9.json'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: '9' })
  })
})

describe('renderShell', () => {
  it('keeps __VEX_DATA__ and client entry outside #app for %vex.body%', async () => {
    const { renderShell } = await import('./ssr.js')
    const html = renderShell(
      '<!doctype html><html><head></head><body><div id="app">%vex.body%</div></body></html>',
      {
        body: '<div data-vex-page><h1>Hi</h1></div>',
        props: { title: 'Hi' },
        clientEntry: '/src/client.ts',
      },
    )
    expect(html).toMatch(/<div id="app"><div data-vex-page><h1>Hi<\/h1><\/div><\/div>/)
    expect(html).toContain('id="__VEX_DATA__"')
    expect(html.indexOf('id="app"')).toBeLessThan(html.indexOf('__VEX_DATA__'))
    expect(html.indexOf('</div>')).toBeLessThan(html.indexOf('__VEX_DATA__'))
    // client script is a sibling of #app, not nested inside it
    const appClose = html.indexOf('</div>', html.indexOf('id="app"'))
    expect(html.indexOf('src="/src/client.ts"')).toBeGreaterThan(appClose)
  })
})
