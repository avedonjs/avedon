/**
 * Production TTFB: default streaming SSR vs bufferHtml baseline (800ms load).
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const port = 3457
const base = `http://127.0.0.1:${port}`

function curlTiming(url) {
  return execSync(
    `curl -o /dev/null -s -w 'ttfb=%{time_starttransfer} total=%{time_total}\\n' '${url}'`,
    { encoding: 'utf8' },
  ).trim()
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
  await waitFor(`${base}/stream-ttfb/stream`)

  console.log('--- curl /stream-ttfb/stream (default SSR stream) ---')
  const streamLine = curlTiming(`${base}/stream-ttfb/stream`)
  console.log(streamLine)

  console.log('--- curl /stream-ttfb/buffer (bufferHtml) ---')
  const bufferLine = curlTiming(`${base}/stream-ttfb/buffer`)
  console.log(bufferLine)

  const streamTtfb = Number(streamLine.match(/ttfb=([\d.]+)/)?.[1] ?? NaN)
  const bufferTtfb = Number(bufferLine.match(/ttfb=([\d.]+)/)?.[1] ?? NaN)
  if (!Number.isFinite(streamTtfb) || !Number.isFinite(bufferTtfb)) {
    throw new Error('Failed to parse curl timings')
  }
  if (streamTtfb >= 0.5) {
    throw new Error(`default stream TTFB too high (${streamTtfb}s), expected well below 800ms load`)
  }
  if (bufferTtfb < 0.7) {
    throw new Error(`bufferHtml TTFB too low (${bufferTtfb}s), expected ~load delay`)
  }
  if (streamTtfb >= bufferTtfb) {
    throw new Error('default stream TTFB should be lower than bufferHtml TTFB')
  }

  console.log('ttfb-smoke ok')
} finally {
  child.kill('SIGKILL')
}
