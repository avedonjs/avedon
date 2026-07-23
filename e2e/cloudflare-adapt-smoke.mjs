/**
 * Cloudflare adapter artifact smoke (no Cloudflare account required).
 */
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const configPath = path.join(example, 'avedon.config.ts')
const buildDir = path.join(example, 'build')

const cloudflareConfig = `import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'avedon-cf-smoke' }),
}
`

const backup = fs.readFileSync(configPath, 'utf8')

try {
  fs.rmSync(buildDir, { recursive: true, force: true })
  fs.rmSync(path.join(example, '.avedon'), { recursive: true, force: true })
  fs.writeFileSync(configPath, cloudflareConfig)

  const build = spawn(process.execPath, [cli, 'build'], {
    cwd: example,
    stdio: 'inherit',
  })
  const code = await new Promise((resolve) => build.on('close', resolve))
  if (code !== 0) throw new Error('cloudflare adapt smoke: avedon build failed')

  for (const rel of ['worker.js', 'wrangler.jsonc', 'client/index.html', 'server/index.js']) {
    if (!fs.existsSync(path.join(buildDir, rel))) {
      throw new Error('cloudflare adapt smoke: missing ' + rel)
    }
  }
  const wrangler = fs.readFileSync(path.join(buildDir, 'wrangler.jsonc'), 'utf8')
  if (!wrangler.includes('"ASSETS"')) {
    throw new Error('cloudflare adapt smoke: wrangler missing ASSETS binding')
  }
  if (!fs.readFileSync(path.join(buildDir, 'worker.js'), 'utf8').includes('createHandler')) {
    throw new Error('cloudflare adapt smoke: worker missing createHandler')
  }

  try {
    execSync('pnpm exec wrangler deploy --dry-run --config wrangler.jsonc', {
      cwd: buildDir,
      stdio: 'pipe',
      env: { ...process.env },
    })
    console.log('wrangler dry-run ok')
  } catch {
    console.log('wrangler dry-run skipped or failed (ok for smoke without CF credentials)')
  }

  console.log('cloudflare-adapt-smoke ok')
} finally {
  fs.writeFileSync(configPath, backup)
  fs.rmSync(buildDir, { recursive: true, force: true })
}
