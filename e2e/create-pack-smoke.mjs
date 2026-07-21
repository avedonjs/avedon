/**
 * npm pack + isolated install smoke for create-avedon-app (pre-publish).
 */
import { execFileSync, execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.join(root, 'packages/create-avedon-app')
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-pack-'))

try {
  execSync('pnpm build', { cwd: pkgDir, stdio: 'inherit' })

  const packOut = execSync('npm pack --json', { cwd: pkgDir, encoding: 'utf8' })
  const tarball = JSON.parse(packOut)[0].filename
  const tarballPath = path.join(pkgDir, tarball)

  console.log('--- npm pack output ---')
  console.log(tarball)

  const listing = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
  console.log('--- tarball listing (first 40 lines) ---')
  console.log(listing.split('\n').slice(0, 40).join('\n'))

  if (listing.includes('../packages/')) {
    throw new Error('tarball leaks monorepo ../packages paths')
  }
  if (!listing.includes('package/template/package.json')) {
    throw new Error('template missing from tarball')
  }

  execFileSync('npm', ['install', tarballPath], {
    cwd: isolated,
    stdio: 'inherit',
    env: { ...process.env, npm_config_user_agent: 'npm' },
  })

  const create = spawn(
    process.execPath,
    ['node_modules/create-avedon-app/dist/cli.js', 'test-app'],
    { cwd: isolated, stdio: 'inherit' },
  )
  const code = await new Promise((resolve) => create.on('close', resolve))
  if (code !== 0) throw new Error('create-avedon-app cli failed')

  const app = path.join(isolated, 'test-app')
  if (!fs.existsSync(path.join(app, 'src/routes.ts'))) {
    throw new Error('scaffold missing routes.ts')
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  if (pkg.dependencies.avedon?.startsWith('file:')) {
    throw new Error('isolated scaffold must not rewrite deps to file:')
  }

  console.log('create-pack-smoke ok')
} finally {
  fs.rmSync(isolated, { recursive: true, force: true })
}
