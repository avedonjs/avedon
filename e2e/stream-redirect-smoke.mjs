/**
 * Streaming SSR: HTTP redirect before shell, client redirect / error boundary after shell.
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const port = 3458
const base = `http://127.0.0.1:${port}`

async function waitFor(url, ms = 60_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

try {
  execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
} catch {
  /* none */
}

const build = spawn(process.execPath, [cli, 'build'], {
  cwd: example,
  stdio: 'inherit',
})
const buildCode = await new Promise((resolve) => build.on('close', resolve))
if (buildCode !== 0) throw new Error('avedon build failed')

const child = spawn(process.execPath, ['build/server.js'], {
  cwd: example,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port) },
})

try {
  await waitFor(`${base}/`)

  const fastHead = execSync(
    `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' '${base}/stream-redirect/fast'`,
    { encoding: 'utf8' },
  ).trim()
  console.log('--- curl -I fast redirect ---', fastHead)
  if (!fastHead.startsWith('302')) {
    throw new Error(`Expected HTTP 302 for fast load redirect, got: ${fastHead}`)
  }
  if (!fastHead.includes('stream-redirect=ok')) {
    throw new Error(`Fast redirect Location missing target: ${fastHead}`)
  }

  const slowBody = execSync(`curl -s --max-time 15 '${base}/stream-redirect/slow'`, {
    encoding: 'utf8',
  })
  console.log('--- curl slow redirect (first 200 chars) ---', slowBody.slice(0, 200))
  if (!slowBody.includes('window.location.href')) {
    throw new Error('Slow load redirect should inject client-side location script')
  }
  if (!slowBody.includes('<html')) {
    throw new Error('Slow redirect response should complete HTML stream')
  }

  const errBody = execSync(`curl -s --max-time 15 '${base}/stream-error/slow'`, {
    encoding: 'utf8',
  })
  console.log('--- curl slow notFound after shell ---', errBody.includes('data-error-lab') ? 'has error boundary' : errBody.slice(0, 120))
  if (!errBody.includes('data-error-lab') && !errBody.includes('Not Found')) {
    throw new Error('Slow load notFound should render route notFound UI in stream')
  }
  if (!errBody.includes('</html>')) {
    throw new Error('Slow error stream should finish (closing html present)')
  }

  console.log('stream-redirect-smoke ok')
} finally {
  child.kill('SIGKILL')
}
