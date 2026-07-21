/**
 * ISR stale-while-revalidate smoke (production server + on-disk SSG).
 */
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const port = 3456
const base = `http://127.0.0.1:${port}`

try {
  execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
} catch {
  /* none */
}

function parseBuiltAt(html) {
  const m = html.match(/data-isr-lab[^>]*>built:(\d+)/) ?? html.match(/built:(\d+)/)
  if (!m) throw new Error('ISR builtAt missing in ' + html.slice(0, 300))
  return Number(m[1])
}

async function waitFor(url, ms = 60_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

const build = spawn(process.execPath, [cli, 'build'], {
  cwd: example,
  stdio: 'inherit',
})
const buildCode = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    build.kill('SIGKILL')
    reject(new Error('avedon build timed out after 180s'))
  }, 180_000)
  build.on('close', (code) => {
    clearTimeout(timer)
    resolve(code)
  })
})
if (buildCode !== 0) throw new Error('avedon build failed')

const child = spawn(process.execPath, ['build/server.js'], {
  cwd: example,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port) },
  detached: true,
})

function killServer() {
  if (child.pid == null) return
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

try {
  await waitFor(`${base}/isr-lab`)

  const html1 = await (await fetch(`${base}/isr-lab`)).text()
  const a = parseBuiltAt(html1)
  const htmlQuick = await (await fetch(`${base}/isr-lab`)).text()
  const a2 = parseBuiltAt(htmlQuick)
  if (a2 !== a) throw new Error('Expected same cached builtAt on back-to-back requests')

  await new Promise((r) => setTimeout(r, 1200))

  const start = Date.now()
  let b = a
  while (Date.now() - start < 8000) {
    const html = await (await fetch(`${base}/isr-lab`)).text()
    b = parseBuiltAt(html)
    if (b !== a) break
    await new Promise((r) => setTimeout(r, 300))
  }
  if (b === a) {
    throw new Error('Expected regenerated builtAt after revalidate window')
  }

  console.log('isr-smoke ok')
} finally {
  killServer()
}
