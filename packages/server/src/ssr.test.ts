import { describe, expect, it } from 'vitest'
import { renderShellPrefix } from './ssr.js'

const withTitle =
  '<!doctype html><html><head><title>base</title>%avedon.head%</head><body><div id="app">'
const noTitle = '<!doctype html><html><head>%avedon.head%</head><body><div id="app">'

describe('shell head', () => {
  it('replaces an existing title', () => {
    const out = renderShellPrefix(withTitle, { head: { title: 'Post 1' } })
    expect(out).toContain('<title>Post 1</title>')
    expect(out).not.toContain('<title>base</title>')
  })

  it('appends a title when app.html has none', () => {
    const out = renderShellPrefix(noTitle, { head: { title: 'Post 1' } })
    expect(out).toContain('<title>Post 1</title>')
  })

  it('keeps the app.html title when head has none', () => {
    const out = renderShellPrefix(withTitle, { head: { description: 'd' } })
    expect(out).toContain('<title>base</title>')
  })

  it('escapes title and description', () => {
    const out = renderShellPrefix(withTitle, {
      head: { title: '<script>&', description: '"x" & <y>' },
    })
    expect(out).not.toContain('<title><script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('name="description"')
    expect(out).not.toMatch(/content="[^"]*<y>/)
  })

  it('replaces an existing description meta', () => {
    const app =
      '<!doctype html><html><head><meta name="description" content="old" />%avedon.head%</head><body><div id="app">'
    const out = renderShellPrefix(app, { head: { description: 'new' } })
    expect(out).toContain('content="new"')
    expect(out).not.toContain('content="old"')
  })

  it('appends raw head html verbatim', () => {
    const out = renderShellPrefix(withTitle, {
      head: { html: '<meta property="og:type" content="article" />' },
    })
    expect(out).toContain('<meta property="og:type" content="article" />')
  })

  it('leaves the document unchanged without head', () => {
    const out = renderShellPrefix(withTitle)
    expect(out).toContain('<title>base</title>')
  })
})
