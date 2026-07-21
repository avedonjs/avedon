import { describe, expect, it } from 'vitest'
import { buildSsgPages, renderSsgPage } from './ssg.js'

const appHtml =
  '<!doctype html><html><head></head><body><div id="app">%avedon.body%</div></body></html>'

describe('buildSsgPages', () => {
  it('expands getStaticPaths into pages', async () => {
    const pages = await buildSsgPages(
      [
        {
          path: '/docs/:slug',
          render: 'ssg',
          getStaticPaths: () => ['/docs/intro', '/docs/api'],
          component: {
            async load({ params }) {
              return { slug: params.slug }
            },
            render(props = {}) {
              return `<h1>${props.slug}</h1>`
            },
          },
        },
      ],
      appHtml,
    )
    expect(pages.map((p) => p.path).sort()).toEqual(['/docs/api', '/docs/intro'])
    expect(pages.find((p) => p.path === '/docs/intro')?.html).toContain('<h1>intro</h1>')
  })

  it('wraps with layouts from the match chain', async () => {
    const pages = await buildSsgPages(
      [
        {
          path: '/blog',
          layout: {
            render(props = {}) {
              return `<div class="shell">${props.children}</div>`
            },
          },
          children: [
            {
              path: ':slug',
              render: 'ssg',
              getStaticPaths: () => ['/blog/hello'],
              component: {
                render: () => `<article>hi</article>`,
              },
            },
          ],
        },
      ],
      appHtml,
    )
    expect(pages).toHaveLength(1)
    expect(pages[0].html).toContain(
      '<div class="shell"><div data-avedon-page><article>hi</article></div></div>',
    )
  })

  it('accepts entries as alias of getStaticPaths', async () => {
    const pages = await buildSsgPages(
      [
        {
          path: '/p/:id',
          render: 'ssg',
          entries: () => ['/p/1'],
          component: { render: () => 'x' },
        },
      ],
      appHtml,
    )
    expect(pages).toHaveLength(1)
    expect(pages[0].path).toBe('/p/1')
  })
})

describe('renderSsgPage', () => {
  it('renders a single pathname', async () => {
    const page = await renderSsgPage(
      [
        {
          path: '/docs/:slug',
          render: 'ssg',
          getStaticPaths: () => ['/docs/intro'],
          component: {
            load: ({ params }) => ({ slug: params.slug }),
            render: (props = {}) => `<p>${props.slug}</p>`,
          },
        },
      ],
      '/docs/intro',
      appHtml,
    )
    expect(page?.path).toBe('/docs/intro')
    expect(page?.html).toContain('<p>intro</p>')
  })

  it('returns null for non-ssg routes', async () => {
    const page = await renderSsgPage(
      [{ path: '/x', render: 'ssr', component: { render: () => 'x' } }],
      '/x',
      appHtml,
    )
    expect(page).toBeNull()
  })
})
