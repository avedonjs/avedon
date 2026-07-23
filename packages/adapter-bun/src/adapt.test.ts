import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdapterBuilder } from '@avedon/shared'
import { bunAdapter } from './index.js'

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
    getManifest: () => ({ routes: [] }),
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

describe('bunAdapter.adapt', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('writes client, SSG HTML, and Bun.serve server.js', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'ssr', 'index.js')
    await bunAdapter({ out }).adapt(mockBuilder(tmp, serverEntry))

    expect(fs.existsSync(path.join(out, 'client', 'assets-client.js'))).toBe(true)
    expect(fs.readFileSync(path.join(out, 'client', 'index.html'), 'utf8')).toContain('home')
    expect(fs.readFileSync(path.join(out, 'client', 'docs', 'intro', 'index.html'), 'utf8')).toContain(
      'intro',
    )
    const server = fs.readFileSync(path.join(out, 'server.js'), 'utf8')
    expect(server).toContain('Bun.serve')
    expect(server).toContain('createHandler')
    expect(server).toContain('tryServeSsgIsrBun')
    expect(server).toContain('resolveUnderRoot')
  })

  it('does not throw the stub error', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'ssr', 'index.js')
    await expect(bunAdapter({ out }).adapt(mockBuilder(tmp, serverEntry))).resolves.toBeUndefined()
  })
})
