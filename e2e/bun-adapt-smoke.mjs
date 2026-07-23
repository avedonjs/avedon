/**
 * Bun adapter artifact smoke. Runtime ping runs only when `bun` is on PATH.
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

const bunConfig = `import { bunAdapter } from '@avedon/adapter-bun'

export default {
  adapter: bunAdapter({ out: 'build' }),
}
`

function hasBun() {
  try {
    execSync('bun --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const backup = fs.readFileSync(configPath, 'utf8')

try {
  fs.rmSync(buildDir, { recursive: true, force: true })
  fs.rmSync(path.join(example, '.avedon'), { recursive: true, force: true })
  fs.writeFileSync(configPath, bunConfig)

  const build = spawn(process.execPath, [cli, 'build'], {
    cwd: example,
    stdio: 'inherit',
  })
  const code = await new Promise((resolve) => build.on('close', resolve))
  if (code !== 0) throw new Error('bun adapt smoke: avedon build failed')

  const serverJs = path.join(buildDir, 'server.js')
  if (!fs.existsSync(serverJs)) throw new Error('bun adapt smoke: missing build/server.js')
  if (!fs.existsSync(path.join(buildDir, 'client', 'index.html'))) {
    throw new Error('bun adapt smoke: missing client/index.html')
  }
  const src = fs.readFileSync(serverJs, 'utf8')
  if (!src.includes('Bun.serve')) throw new Error('bun adapt smoke: server.js missing Bun.serve')
  if (!src.includes('tryServeSsgIsrBun')) {
    throw new Error('bun adapt smoke: server.js missing tryServeSsgIsrBun')
  }

  if (hasBun()) {
    const port = 3460
    const child = spawn('bun', ['run', serverJs], {
      cwd: buildDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) },
      detached: true,
    })
    const base = `http://127.0.0.1:${port}`
    try {
      const start = Date.now()
      while (Date.now() - start < 15_000) {
        try {
          const res = await fetch(base + '/')
          if (res.ok || res.status >= 400) break
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      const home = await fetch(base + '/')
      const homeHtml = await home.text()
      if (!home.ok) throw new Error('bun runtime: home status ' + home.status)
      if (!homeHtml.includes('avedon')) throw new Error('bun runtime: home missing brand')
      const post = await fetch(base + '/posts/1')
      if (!post.ok) throw new Error('bun runtime: post status ' + post.status)
      console.log('bun runtime ping ok')
    } finally {
      if (child.pid != null) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          try {
            child.kill('SIGKILL')
          } catch {
            /* already dead */
          }
        }
      }
    }
  } else {
    console.log('bun runtime ping skipped (bun not on PATH)')
  }

  console.log('bun-adapt-smoke ok')
} finally {
  fs.writeFileSync(configPath, backup)
  fs.rmSync(buildDir, { recursive: true, force: true })
}
