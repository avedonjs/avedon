import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { formatNextSteps, scaffoldApp } from './index.js'
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

    const home = fs.readFileSync(path.join(app, 'src/pages/Home.ave'), 'utf8')
    expect(home).toContain('<style unscoped>')
  })

  it('returns default addon flags when options omitted', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'defaults-app')
    const result = scaffoldApp(app)
    expect(result.tailwind).toBe(false)
    expect(result.orm).toBe('none')
    expect(result.adapter).toBe('node')
    expect(result.name).toBe('defaults-app')
  })

  it('returns adapter node by default', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'defaults-adapter')
    const result = scaffoldApp(app)
    expect(result.adapter).toBe('node')
    const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
    expect(cfg).toContain('@avedon/adapter-node')
  })

  it('scaffolds cloudflare adapter config deps and scripts', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'cf-app')
    scaffoldApp(app, { name: 'cf-app', adapter: 'cloudflare' })
    const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
    expect(cfg).toContain("from '@avedon/adapter-cloudflare'")
    expect(cfg).toContain('cloudflareAdapter')
    expect(cfg).toContain('name: "cf-app"')
    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.dependencies['@avedon/adapter-cloudflare']).toBeTruthy()
    expect(pkg.dependencies['@avedon/adapter-node']).toBeUndefined()
    expect(pkg.devDependencies.wrangler).toBeTruthy()
    expect(pkg.scripts.start).toBe('cd build && wrangler deploy')
    expect(pkg.scripts.deploy).toBe('cd build && wrangler deploy')
  })

  it('scaffolds bun adapter config deps and scripts', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'bun-app')
    scaffoldApp(app, { name: 'bun-app', adapter: 'bun' })
    const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
    expect(cfg).toContain("from '@avedon/adapter-bun'")
    expect(cfg).toContain('bunAdapter')
    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.dependencies['@avedon/adapter-bun']).toBeTruthy()
    expect(pkg.dependencies['@avedon/adapter-node']).toBeUndefined()
    expect(pkg.scripts.start).toBe('bun run build/server.js')
    expect(pkg.scripts.preview).toBe('bun run build/server.js')
  })

  it('links file: cloudflare adapter when monorepo root is set', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'cf-linked')
    const repoRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
    process.env.AVEDON_MONOREPO_ROOT = repoRoot
    try {
      scaffoldApp(app, { name: 'cf-linked', adapter: 'cloudflare' })
      const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
      expect(pkg.dependencies['@avedon/adapter-cloudflare']).toMatch(/^file:/)
    } finally {
      delete process.env.AVEDON_MONOREPO_ROOT
    }
  })

  it('accepts legacy string name as second argument', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'legacy-name')
    const result = scaffoldApp(app, 'legacy-name')
    expect(result.name).toBe('legacy-name')
    expect(result.tailwind).toBe(false)
  })

  it('wires drizzle without schema models', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'drizzle-app')
    scaffoldApp(app, { name: 'drizzle-app', orm: 'drizzle' })

    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.dependencies['drizzle-orm']).toBeTruthy()
    expect(pkg.devDependencies['drizzle-kit']).toBeTruthy()
    expect(pkg.scripts['db:generate']).toContain('drizzle-kit')
    expect(pkg.scripts['db:push']).toContain('drizzle-kit')

    const cfg = fs.readFileSync(path.join(app, 'drizzle.config.ts'), 'utf8')
    expect(cfg).toContain("dialect: 'postgresql'")
    expect(fs.existsSync(path.join(app, 'src/db/schema.ts'))).toBe(false)

    const envEx = fs.readFileSync(path.join(app, '.env.example'), 'utf8')
    expect(envEx).toMatch(/DATABASE_URL=/)
  })

  it('wires prisma without models', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'prisma-app')
    scaffoldApp(app, { name: 'prisma-app', orm: 'prisma' })

    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.dependencies['@prisma/client']).toBeTruthy()
    expect(pkg.devDependencies.prisma).toBeTruthy()
    expect(pkg.scripts['db:generate']).toContain('prisma generate')

    const schema = fs.readFileSync(path.join(app, 'prisma/schema.prisma'), 'utf8')
    expect(schema).toContain('provider = "postgresql"')
    expect(schema).not.toMatch(/\bmodel\b/)
  })

  it('converts starter styles when tailwind is enabled', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'tw-app')
    scaffoldApp(app, { name: 'tw-app', tailwind: true })

    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
    expect(pkg.devDependencies.tailwindcss).toBeTruthy()
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBeTruthy()
    expect(pkg.devDependencies.postcss).toBeTruthy()

    expect(fs.existsSync(path.join(app, 'postcss.config.js'))).toBe(true)
    const css = fs.readFileSync(path.join(app, 'src/app.css'), 'utf8')
    expect(css).toContain('@import "tailwindcss"')
    expect(css).toContain('#09090B')

    const client = fs.readFileSync(path.join(app, 'src/client.ts'), 'utf8')
    expect(client).toContain('./app.css')

    const home = fs.readFileSync(path.join(app, 'src/pages/Home.ave'), 'utf8')
    expect(home).not.toContain('<style unscoped>')
    expect(home.toLowerCase()).toContain('avedon')
    expect(home).toContain('signal')
  })

  it('mentions ORM env next steps when orm is set', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
    dirs.push(dest)
    const app = path.join(dest, 'steps-app')
    const result = scaffoldApp(app, { name: 'steps-app', orm: 'drizzle' })
    const steps = formatNextSteps(result)
    expect(steps).toMatch(/DATABASE_URL|\.env/)
    expect(steps.toLowerCase()).toMatch(/drizzle/)
  })

  it('BUG-008: shell-quotes project name in next-step commands', () => {
    const steps = formatNextSteps({
      dest: '/tmp/x',
      name: `demo; touch /tmp/pwned`,
      packageManager: 'pnpm',
      adapter: 'node',
      tailwind: false,
      orm: 'none',
    })
    expect(steps).toContain(`cd 'demo; touch /tmp/pwned'`)
    expect(steps).not.toMatch(/^ {2}cd demo;/m)
  })

  it('mentions cloudflare deploy next steps', () => {
    const steps = formatNextSteps({
      dest: '/tmp/x',
      name: 'cf-app',
      packageManager: 'pnpm',
      adapter: 'cloudflare',
      tailwind: false,
      orm: 'none',
    })
    expect(steps).toMatch(/wrangler|deploy/i)
    expect(steps).toMatch(/SESSION_SECRET/)
  })

  it('mentions bun run next steps', () => {
    const steps = formatNextSteps({
      dest: '/tmp/x',
      name: 'bun-app',
      packageManager: 'pnpm',
      adapter: 'bun',
      tailwind: false,
      orm: 'none',
    })
    expect(steps).toMatch(/bun run build\/server\.js/)
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
