import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdapterBuilder } from '@avedon/shared'
import { cloudflareAdapter } from './index.js'

function mockBuilder(tmp: string, serverEntry: string): AdapterBuilder {
  const clientSrc = path.join(tmp, 'src-client')
  fs.mkdirSync(clientSrc, { recursive: true })
  fs.mkdirSync(path.dirname(serverEntry), { recursive: true })
  fs.writeFileSync(path.join(clientSrc, 'assets-client.js'), 'console.log(1)')
  fs.writeFileSync(
    serverEntry,
    'export const routes = []; export const appHtml = "<html>%avedon.body%</html>";',
  )

  return {
    getClientDirectory: () => clientSrc,
    getServerEntry: () => serverEntry,
    getSsgPages: () => [
      { path: '/', html: '<html>home</html>' },
      { path: '/docs/intro', html: '<html>intro</html>' },
    ],
    getManifest: () => ({ routes: [] as Array<{ path: string; render?: string; revalidate?: number }> }),
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

describe('cloudflareAdapter.adapt', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-cf-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('writes client, SSG HTML, server copy, worker.js, and wrangler.jsonc', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'ssr', 'index.js')
    const adapter = cloudflareAdapter({ out, name: 'avedon-test' })
    await adapter.adapt(mockBuilder(tmp, serverEntry))

    expect(fs.existsSync(path.join(out, 'client', 'assets-client.js'))).toBe(true)
    expect(fs.readFileSync(path.join(out, 'client', 'index.html'), 'utf8')).toContain('home')
    expect(fs.readFileSync(path.join(out, 'client', 'docs', 'intro', 'index.html'), 'utf8')).toContain(
      'intro',
    )
    expect(fs.existsSync(path.join(out, 'server', 'index.js'))).toBe(true)
    const worker = fs.readFileSync(path.join(out, 'worker.js'), 'utf8')
    expect(worker).toContain('createHandler')
    expect(worker).toContain('./server/index.js')
    expect(worker).toMatch(/export\s+default/)

    const wrangler = JSON.parse(
      fs.readFileSync(path.join(out, 'wrangler.jsonc'), 'utf8').replace(/\/\/.*$/gm, ''),
    )
    expect(wrangler.name).toBe('avedon-test')
    expect(wrangler.main).toBe('./worker.js')
    expect(wrangler.assets.directory).toBe('./client')
    expect(wrangler.assets.binding).toBe('ASSETS')
    expect(wrangler.compatibility_flags).toContain('nodejs_compat')
    expect(wrangler.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not throw the stub error', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'ssr', 'index.js')
    await expect(
      cloudflareAdapter({ out }).adapt(mockBuilder(tmp, serverEntry)),
    ).resolves.toBeUndefined()
  })
})
