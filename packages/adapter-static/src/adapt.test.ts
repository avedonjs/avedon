import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdapterBuilder } from '@avedon/shared'
import { assertStaticCompatible, ssgHtmlPath, staticAdapter } from './index.js'

type ManifestRoute = {
  path: string
  render?: string
  revalidate?: number
  hasActions?: boolean
  hasApi?: boolean
}

function mockBuilder(
  tmp: string,
  opts: {
    routes?: ManifestRoute[]
    ssgPages?: Array<{ path: string; html: string }>
  } = {},
): AdapterBuilder {
  const clientSrc = path.join(tmp, 'src-client')
  fs.mkdirSync(clientSrc, { recursive: true })
  fs.writeFileSync(path.join(clientSrc, 'assets-client.js'), 'console.log(1)')
  const serverEntry = path.join(tmp, 'ssr', 'index.js')
  fs.mkdirSync(path.dirname(serverEntry), { recursive: true })
  fs.writeFileSync(serverEntry, 'export const routes = []')

  const routes = opts.routes ?? [
    { path: '/', render: 'ssg' },
    { path: '/docs/intro', render: 'ssg' },
  ]
  const ssgPages = opts.ssgPages ?? [
    { path: '/', html: '<html>home</html>' },
    { path: '/docs/intro', html: '<html>intro</html>' },
  ]

  return {
    getClientDirectory: () => clientSrc,
    getServerEntry: () => serverEntry,
    getSsgPages: () => ssgPages,
    getManifest: () => ({ routes }),
    writeClient(dest) {
      fs.mkdirSync(dest, { recursive: true })
      fs.copyFileSync(path.join(clientSrc, 'assets-client.js'), path.join(dest, 'assets-client.js'))
    },
    writeFile(file, contents) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, contents)
    },
    mkdirp(dir) {
      fs.mkdirSync(dir, { recursive: true })
    },
  }
}

describe('ssgHtmlPath', () => {
  it('maps / and nested paths', () => {
    expect(ssgHtmlPath('/out', '/')).toBe(path.join('/out', 'index.html'))
    expect(ssgHtmlPath('/out', '/docs/intro')).toBe(path.join('/out', 'docs', 'intro', 'index.html'))
  })

  it('rejects traversal', () => {
    expect(() => ssgHtmlPath('/out', '/../../etc/passwd')).toThrow(/Unsafe SSG path/)
  })
})

describe('assertStaticCompatible', () => {
  it('accepts ssg-only routes', () => {
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/', render: 'ssg' }],
      }),
    ).not.toThrow()
  })

  it('rejects missing render (defaults to ssr)', () => {
    expect(() => assertStaticCompatible({ routes: [{ path: '/x' }] })).toThrow(
      /@avedon\/adapter-static/,
    )
  })

  it('rejects ssr and csr', () => {
    expect(() =>
      assertStaticCompatible({ routes: [{ path: '/a', render: 'ssr' }] }),
    ).toThrow(/\/a/)
    expect(() =>
      assertStaticCompatible({ routes: [{ path: '/b', render: 'csr' }] }),
    ).toThrow(/\/b/)
  })

  it('rejects actions, api, and revalidate', () => {
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/a', render: 'ssg', hasActions: true }],
      }),
    ).toThrow(/actions/)
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/b', render: 'ssg', hasApi: true }],
      }),
    ).toThrow(/api/)
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/c', render: 'ssg', revalidate: 60 }],
      }),
    ).toThrow(/revalidate/)
  })
})

describe('staticAdapter.adapt', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-static-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('writes client + SSG HTML only', async () => {
    const out = path.join(tmp, 'build')
    await staticAdapter({ out }).adapt(mockBuilder(tmp))

    expect(fs.existsSync(path.join(out, 'client', 'assets-client.js'))).toBe(true)
    expect(fs.readFileSync(path.join(out, 'client', 'index.html'), 'utf8')).toContain('home')
    expect(
      fs.readFileSync(path.join(out, 'client', 'docs', 'intro', 'index.html'), 'utf8'),
    ).toContain('intro')
    expect(fs.existsSync(path.join(out, 'server.js'))).toBe(false)
    expect(fs.existsSync(path.join(out, 'server'))).toBe(false)
    expect(fs.existsSync(path.join(out, 'worker.js'))).toBe(false)
  })

  it('fails when getSsgPages is empty', async () => {
    const out = path.join(tmp, 'build')
    await expect(
      staticAdapter({ out }).adapt(
        mockBuilder(tmp, {
          routes: [{ path: '/', render: 'ssg' }],
          ssgPages: [],
        }),
      ),
    ).rejects.toThrow(/no SSG pages/i)
  })

  it('fails on incompatible manifest before writing server artifacts', async () => {
    const out = path.join(tmp, 'build')
    await expect(
      staticAdapter({ out }).adapt(
        mockBuilder(tmp, { routes: [{ path: '/', render: 'ssr' }] }),
      ),
    ).rejects.toThrow(/@avedon\/adapter-static/)
  })
})
