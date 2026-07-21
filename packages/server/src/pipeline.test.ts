import { describe, expect, it } from 'vitest'
import { error, notFound } from './errors.js'
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
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'http://localhost',
        },
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

  it('streams shell before slow renderInto boundary settles', async () => {
    let resolve!: (v: string) => void
    const slow = new Promise<string>((r) => {
      resolve = r
    })
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/',
          component: {
            render: () => '',
            async renderInto(ctrl) {
              ctrl.enqueueHtml('<p>early</p>')
              ctrl.enqueueBoundary(slow, (value, enqueue) => {
                enqueue(`<p class="late">${value}</p>`)
              })
            },
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/'))
    expect(res.body).toBeTruthy()
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let early = ''
    while (!early.includes('<p>early</p>') || !early.includes('vex-b-')) {
      const { done, value } = await reader.read()
      if (done) break
      early += decoder.decode(value, { stream: true })
    }
    expect(early).toContain('<p>early</p>')
    expect(early).toContain('vex-b-')
    expect(early).not.toContain('class="late"')

    resolve('done')
    let rest = decoder.decode()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest += decoder.decode(value, { stream: true })
    }
    expect(rest).toContain('class=\\"late\\"')
    expect(rest).toContain('done')
    expect(rest).toContain('__VEX_DATA__')
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
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'http://localhost',
        },
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

  it('uses route-level notFound when load throws notFound()', async () => {
    const handler = createHandler({
      appHtml,
      notFoundComponent: { render: () => `<p>global-404</p>` },
      errorComponent: { render: () => `<p>global-error</p>` },
      routes: [
        {
          path: '/posts/:id',
          notFound: { render: () => `<p>route-404</p>` },
          component: {
            async load() {
              throw notFound()
            },
            render: () => 'nope',
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/posts/missing'))
    expect(res.status).toBe(404)
    const html = await res.text()
    expect(html).toContain('route-404')
    expect(html).not.toContain('global-error')
  })

  it('uses route-level error when load throws error(500)', async () => {
    const handler = createHandler({
      appHtml,
      errorComponent: { render: () => `<p>global</p>` },
      routes: [
        {
          path: '/boom',
          error: {
            render(props = {}) {
              return `<p>route-${props.status}:${props.message}</p>`
            },
          },
          component: {
            async load() {
              throw error(500, 'explode')
            },
            render: () => 'nope',
          },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/boom'))
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('route-500:explode')
  })

  it('rejects cross-site form actions with 403', async () => {
    const handler = createHandler({
      appHtml,
      routes: [
        {
          path: '/x',
          component: {
            render: () => 'ok',
            actions: { bump: async () => ({ n: 1 }) },
          },
        },
      ],
    })
    const res = await handler(
      new Request('http://localhost/x?_action=bump', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://evil.example',
        },
        body: '',
      }),
    )
    expect(res.status).toBe(403)
  })

  it('allows form actions when csrf is false', async () => {
    const handler = createHandler({
      appHtml,
      csrf: false,
      routes: [
        {
          path: '/x',
          component: {
            render: (p = {}) => `<p>${p.n ?? 0}</p>`,
            actions: { bump: async () => ({ n: 2 }) },
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
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<p>2</p>')
  })

  it('runs middleware before route match', async () => {
    const order: string[] = []
    const handler = createHandler({
      appHtml,
      hooks: {
        middleware: [
          async ({ request, resolve }) => {
            order.push('mw')
            const res = await resolve(request)
            order.push('mw-out')
            return res
          },
        ],
      },
      routes: [
        {
          path: '/',
          component: {
            render: () => {
              order.push('render')
              return 'ok'
            },
          },
        },
      ],
    })
    await handler(new Request('http://localhost/'))
    expect(order).toEqual(['mw', 'render', 'mw-out'])
  })

  it('middleware short-circuit skips guards', async () => {
    let guardRan = false
    const handler = createHandler({
      appHtml,
      hooks: {
        middleware: [async () => new Response('limited', { status: 429 })],
      },
      routes: [
        {
          path: '/',
          guard: () => {
            guardRan = true
            return true
          },
          component: { render: () => 'ok' },
        },
      ],
    })
    const res = await handler(new Request('http://localhost/'))
    expect(res.status).toBe(429)
    expect(guardRan).toBe(false)
  })

  it('runs middleware then handle then core', async () => {
    const order: string[] = []
    const handler = createHandler({
      appHtml,
      hooks: {
        middleware: [
          async ({ request, resolve }) => {
            order.push('mw')
            return resolve(request)
          },
        ],
        handle: async ({ request, resolve }) => {
          order.push('handle')
          return resolve(request)
        },
      },
      routes: [
        {
          path: '/',
          component: {
            render: () => {
              order.push('core')
              return 'ok'
            },
          },
        },
      ],
    })
    await handler(new Request('http://localhost/'))
    expect(order).toEqual(['mw', 'handle', 'core'])
  })

  it('handle-only apps still work without middleware', async () => {
    const handler = createHandler({
      appHtml,
      hooks: {
        handle: async ({ request, resolve }) => {
          const res = await resolve(request)
          const headers = new Headers(res.headers)
          headers.set('x-handle', '1')
          return new Response(res.body, { status: res.status, headers })
        },
      },
      routes: [{ path: '/', component: { render: () => 'hi' } }],
    })
    const res = await handler(new Request('http://localhost/'))
    expect(res.headers.get('x-handle')).toBe('1')
    expect(await res.text()).toContain('hi')
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
