import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isRegenerating, ssgHtmlPath, tryServeSsgIsr, writeHtmlAtomic } from './ssg-isr.js'
import type { Routes } from '@vexjs/server'

const appHtml =
  '<!doctype html><html><head></head><body><div id="app">%vex.body%</div></body></html>'

function makeRes() {
  const sink = new PassThrough()
  const chunks: Buffer[] = []
  sink.on('data', (c) => chunks.push(Buffer.from(c)))
  const res = sink as unknown as ServerResponse & { headers: Record<string, string> }
  res.headers = {}
  res.setHeader = (k: string, v: string | number | readonly string[]) => {
    res.headers[k.toLowerCase()] = String(v)
    return res
  }
  return { res, chunks, sink }
}

describe('writeHtmlAtomic', () => {
  it('replaces the target file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vex-isr-'))
    const file = path.join(dir, 'index.html')
    writeHtmlAtomic(file, 'one')
    writeHtmlAtomic(file, 'two')
    expect(fs.readFileSync(file, 'utf8')).toBe('two')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('tryServeSsgIsr', () => {
  let dir: string

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('serves immutable SSG without regenerating', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vex-isr-'))
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

    const req = Object.assign(new EventEmitter(), { method: 'GET' }) as IncomingMessage
    const { res } = makeRes()
    const handled = tryServeSsgIsr({
      req,
      res,
      clientDir: dir,
      pathname: '/',
      routes,
      appHtml,
    })
    expect(handled).toBe(true)
    expect(isRegenerating('/')).toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(fs.readFileSync(file, 'utf8')).toBe('<html>static</html>')
  })

  it('regenerates in background when revalidate window has elapsed', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vex-isr-'))
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

    const req = Object.assign(new EventEmitter(), { method: 'GET' }) as IncomingMessage
    const { res } = makeRes()
    const handled = tryServeSsgIsr({
      req,
      res,
      clientDir: dir,
      pathname: '/docs/intro',
      routes,
      appHtml,
    })
    expect(handled).toBe(true)

    await vi.waitFor(
      () => {
        expect(fs.readFileSync(file, 'utf8')).toContain('<h1>intro</h1>')
      },
      { timeout: 3000 },
    )
  })
})
