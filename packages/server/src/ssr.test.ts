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

  it('replaces a title regardless of tag case', () => {
    const app =
      '<!doctype html><html><HEAD><TITLE>base</TITLE>%avedon.head%</HEAD><body><div id="app">'
    const out = renderShellPrefix(app, { head: { title: 'Post 1' } })
    expect(out).toContain('<title>Post 1</title>')
    expect(out).not.toContain('base')
  })

  it('links Vite client CSS hrefs in the head', () => {
    const out = renderShellPrefix(noTitle, {
      clientCss: ['/assets/client-abc.css', '/assets/other.css'],
    })
    expect(out).toContain('<link rel="stylesheet" href="/assets/client-abc.css" />')
    expect(out).toContain('<link rel="stylesheet" href="/assets/other.css" />')
  })

  it('replaces a description meta with leading attributes and single quotes', () => {
    const app =
      `<!doctype html><html><head><meta charset="utf-8" /><meta data-x name='description' content='old' />%avedon.head%</head><body><div id="app">`
    const out = renderShellPrefix(app, { head: { description: 'new' } })
    expect(out).toContain('content="new"')
    expect(out).not.toContain("content='old'")
    expect(out).toContain('<meta charset="utf-8" />')
  })

  it('appends raw head html verbatim', () => {
    const out = renderShellPrefix(withTitle, {
      head: { html: '<meta property="og:type" content="article" />' },
    })
    expect(out).toContain('<meta property="og:type" content="article" />')
  })

  it('mirrors title to og:title and twitter:title', () => {
    const out = renderShellPrefix(withTitle, { head: { title: 'Post 1' } })
    expect(out).toContain('<meta property="og:title" content="Post 1" />')
    expect(out).toContain('<meta name="twitter:title" content="Post 1" />')
  })

  it('replaces existing og/twitter title tags when head.title is set', () => {
    const app =
      '<!doctype html><html><head><title>base</title>' +
      '<meta property="og:title" content="old" />' +
      '<meta name="twitter:title" content="old" />' +
      '%avedon.head%</head><body><div id="app">'
    const out = renderShellPrefix(app, { head: { title: 'Post 1' } })
    expect(out).toContain('property="og:title" content="Post 1"')
    expect(out).toContain('name="twitter:title" content="Post 1"')
    expect(out).not.toContain('content="old"')
  })

  it('mirrors description to og:description and twitter:description', () => {
    const out = renderShellPrefix(withTitle, { head: { description: 'excerpt' } })
    expect(out).toContain('<meta property="og:description" content="excerpt" />')
    expect(out).toContain('<meta name="twitter:description" content="excerpt" />')
  })

  it('leaves the document unchanged without head', () => {
    const out = renderShellPrefix(withTitle)
    expect(out).toContain('<title>base</title>')
  })
})
