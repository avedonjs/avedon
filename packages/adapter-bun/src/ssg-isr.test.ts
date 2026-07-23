import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Routes } from '@avedon/server'
import { isRegenerating, ssgHtmlPath, tryServeSsgIsrBun, writeHtmlAtomic } from './ssg-isr.js'

const appHtml =
  '<!doctype html><html><head></head><body><div id="app">%avedon.body%</div></body></html>'

describe('writeHtmlAtomic', () => {
  it('replaces the target file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-isr-'))
    const file = path.join(dir, 'index.html')
    writeHtmlAtomic(file, 'one')
    writeHtmlAtomic(file, 'two')
    expect(fs.readFileSync(file, 'utf8')).toBe('two')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('tryServeSsgIsrBun', () => {
  let dir: string

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns null when no file', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-isr-'))
    const res = tryServeSsgIsrBun({
      request: new Request('http://localhost/missing'),
      clientDir: dir,
      pathname: '/missing',
      routes: [{ path: '/missing', render: 'ssg', component: { render: () => '' } }],
      appHtml,
    })
    expect(res).toBeNull()
  })

  it('serves immutable SSG without regenerating', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-isr-'))
    const file = ssgHtmlPath(dir, '/')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '<html>static</html>')

    const routes: Routes = [
      {
        path: '/',
        render: 'ssg',
        component: { render: () => 'fresh' },
      },
    ]

    const res = tryServeSsgIsrBun({
      request: new Request('http://localhost/'),
      clientDir: dir,
      pathname: '/',
      routes,
      appHtml,
    })
    expect(res).not.toBeNull()
    expect(await res!.text()).toBe('<html>static</html>')
    expect(isRegenerating('/')).toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(fs.readFileSync(file, 'utf8')).toBe('<html>static</html>')
  })

  it('regenerates in background when revalidate window has elapsed', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-isr-'))
    const file = ssgHtmlPath(dir, '/docs/intro')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '<html>stale</html>')
    const old = Date.now() - 120_000
    fs.utimesSync(file, old / 1000, old / 1000)

    const routes: Routes = [
      {
        path: '/docs/:slug',
        render: 'ssg',
        revalidate: 60,
        getStaticPaths: () => ['/docs/intro'],
        component: {
          load: ({ params }) => ({ slug: params.slug }),
          render: (props = {}) => `<h1>${props.slug}</h1>`,
        },
      },
    ]

    const res = tryServeSsgIsrBun({
      request: new Request('http://localhost/docs/intro'),
      clientDir: dir,
      pathname: '/docs/intro',
      routes,
      appHtml,
    })
    expect(res).not.toBeNull()
    expect(await res!.text()).toBe('<html>stale</html>')

    await vi.waitFor(
      () => {
        expect(fs.readFileSync(file, 'utf8')).toContain('<h1>intro</h1>')
      },
      { timeout: 3000 },
    )
  })
})
