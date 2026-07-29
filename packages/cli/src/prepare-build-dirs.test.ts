import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareBuildDirs } from './prepare-build-dirs.js'

describe('prepareBuildDirs', () => {
  let root = ''

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('removes stale build/ and .avedon before a rebuild', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-prepare-build-'))
    const buildClient = path.join(root, 'build', 'client', 'docs', 'index.html')
    const cacheFile = path.join(root, '.avedon', 'client', 'assets', 'client.js')
    fs.mkdirSync(path.dirname(buildClient), { recursive: true })
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(buildClient, '<script type="module" src="/assets/client.js"></script>')
    fs.writeFileSync(cacheFile, 'export {}')

    prepareBuildDirs(root)

    expect(fs.existsSync(path.join(root, 'build'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.avedon'))).toBe(false)
  })
})
