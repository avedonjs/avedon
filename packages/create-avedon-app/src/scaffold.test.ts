import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scaffoldApp } from './index.js'
import { fileURLToPath } from 'node:url'

const dirs: string[] = []

afterEach(() => {
  for (const d of dirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

describe('scaffoldApp', () => {
  it('writes aligned template files', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    // scaffold into a child so parent temp dir can exist
    const app = path.join(dest, 'demo-app')
    scaffoldApp(app, 'demo-app')

    expect(fs.existsSync(path.join(app, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(app, 'src/server-entry.ts'))).toBe(true)
    expect(fs.existsSync(path.join(app, 'src/error.ave'))).toBe(true)
    expect(fs.existsSync(path.join(app, 'src/not-found.ave'))).toBe(true)
    expect(fs.existsSync(path.join(app, 'tsconfig.json'))).toBe(true)

    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('demo-app')

    const entry = fs.readFileSync(path.join(app, 'src/server-entry.ts'), 'utf8')
    expect(entry).toContain('errorComponent')
    expect(entry).toContain('notFoundComponent')
  })

  it('refuses existing directories', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    expect(() => scaffoldApp(dest, 'x')).toThrow(/Directory exists/)
  })

  it('links file: deps when monorepo root is found', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'linked-app')
    const repoRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
    process.env.AVEDON_MONOREPO_ROOT = repoRoot
    try {
      scaffoldApp(app, 'linked-app')
      const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
      expect(pkg.dependencies.avedon).toMatch(/^file:/)
      expect(pkg.dependencies['@avedon/server']).toMatch(/^file:/)
    } finally {
      delete process.env.AVEDON_MONOREPO_ROOT
    }
  })
})
