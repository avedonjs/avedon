/**
 * Scaffold + install + dev smoke inside the monorepo workspace (file: deps + workspace:*).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const appDir = path.join(root, 'examples', 'create-smoke-tmp')

async function waitFor(url, ms = 60_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

fs.rmSync(appDir, { recursive: true, force: true })

await run(process.execPath, [cli, 'create', appDir, '--yes'], {
  cwd: root,
  env: { ...process.env, AVEDON_MONOREPO_ROOT: root },
})

const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'))
if (!pkg.dependencies.avedon?.startsWith('file:')) {
  throw new Error('Expected file: avedon dep when AVEDON_MONOREPO_ROOT is set')
}

await run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: root })

const dev = spawn('pnpm', ['exec', 'avedon', 'dev'], {
  cwd: appDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})

function killDevTree() {
  if (dev.pid == null) return
  try {
    process.kill(-dev.pid, 'SIGKILL')
  } catch {
    try {
      dev.kill('SIGKILL')
    } catch {
      /* already dead */
    }
  }
}

try {
  await waitFor('http://localhost:5173/')
  const home = await (await fetch('http://localhost:5173/')).text()
  if (!home.toLowerCase().includes('avedon')) {
    throw new Error('Scaffolded home missing brand')
  }
  console.log('create-smoke ok')
} finally {
  killDevTree()
  fs.rmSync(appDir, { recursive: true, force: true })
}
