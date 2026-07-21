import { describe, expect, it } from 'vitest'
import { buildSsgPages } from './ssg.js'

const appHtml =
  '<!doctype html><html><head></head><body><div id="app">%vex.body%</div></body></html>'

describe('cli ssg re-export', () => {
  it('buildSsgPages still works via CLI module', async () => {
    const pages = await buildSsgPages(
      [
        {
          path: '/',
          render: 'ssg',
          component: { render: () => 'home' },
        },
      ],
      appHtml,
    )
    expect(pages).toHaveLength(1)
    expect(pages[0].html).toContain('home')
  })
})
