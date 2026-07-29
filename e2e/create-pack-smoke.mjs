/**
 * Pack + isolated install + build smoke for create-avedon-app (pre-publish).
 * Uses local tarballs (workspace:* rewritten) so unpublished APIs are covered.
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-pack-'))
const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-pack-out-'))

const { packAvedonTarballs } = await import(
  pathToFileURL(path.join(root, 'scripts/pack-avedon-tarballs.mjs')).href
)

try {
  const { tarballs } = packAvedonTarballs(packDir)
  const createTgz = tarballs.get('create-avedon-app')
  if (!createTgz || !fs.existsSync(createTgz)) {
    throw new Error('create-avedon-app tarball missing')
  }

  const listing = execFileSync('tar', ['-tzf', createTgz], { encoding: 'utf8' })
  if (listing.includes('../packages/')) {
    throw new Error('tarball leaks monorepo ../packages paths')
  }
  if (!listing.includes('package/template/package.json')) {
    throw new Error('template missing from tarball')
  }

  execFileSync('npm', ['install', createTgz], {
    cwd: isolated,
    stdio: 'inherit',
    env: { ...process.env, npm_config_user_agent: 'npm' },
  })

  // Force npm ranges (no monorepo file: rewrite during scaffold).
  const env = { ...process.env }
  delete env.AVEDON_MONOREPO_ROOT

  const create = spawn(
    process.execPath,
    ['node_modules/create-avedon-app/dist/cli.js', 'test-app', '--yes'],
    { cwd: isolated, stdio: 'inherit', env },
  )
  const code = await new Promise((resolve) => create.on('close', resolve))
  if (code !== 0) throw new Error('create-avedon-app cli failed')

  const app = path.join(isolated, 'test-app')
  if (!fs.existsSync(path.join(app, 'src/routes.ts'))) {
    throw new Error('scaffold missing routes.ts')
  }

  const pkgPath = path.join(app, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (
    typeof pkg.dependencies?.avedon === 'string' &&
    pkg.dependencies.avedon.startsWith('file:') &&
    !pkg.dependencies.avedon.endsWith('.tgz')
  ) {
    throw new Error('isolated scaffold must not rewrite deps to monorepo file: packages')
  }

  // Point app at packed tarballs instead of the registry.
  pkg.dependencies ??= {}
  for (const [name, tgz] of tarballs) {
    if (name === 'create-avedon-app') continue
    if (pkg.dependencies[name] != null) pkg.dependencies[name] = tgz
  }
  // Ensure transitive packages resolve from local packs (not registry).
  pkg.dependencies['@avedon/compiler'] = tarballs.get('@avedon/compiler')
  pkg.dependencies['@avedon/shared'] = tarballs.get('@avedon/shared')
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  execFileSync('npm', ['install'], {
    cwd: app,
    stdio: 'inherit',
    env: { ...env, npm_config_user_agent: 'npm' },
  })

  execFileSync('npx', ['avedon', 'build'], {
    cwd: app,
    stdio: 'inherit',
    env,
  })

  if (!fs.existsSync(path.join(app, 'build', 'server.js'))) {
    throw new Error('avedon build missing build/server.js')
  }
  if (!fs.existsSync(path.join(app, 'build', 'client'))) {
    throw new Error('avedon build missing build/client')
  }

  console.log('create-pack-smoke ok')
} finally {
  fs.rmSync(isolated, { recursive: true, force: true })
  fs.rmSync(packDir, { recursive: true, force: true })
}
