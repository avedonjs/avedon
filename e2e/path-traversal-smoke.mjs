/**
 * HTTP-level path traversal smoke (BUG-001) against production node adapter.
 */
import { spawn, execSync, execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const port = 3459
const base = `http://127.0.0.1:${port}`

const PASSWD_LEAK = /root:.*:0:0:/

/** Vectors that must be rejected (403 or 400), never leak root-fs content. */
const VECTORS = [
  { name: 'plain-traversal', path: '/../../../etc/passwd' },
  { name: 'url-encoded', path: '/..%2f..%2f..%2fetc%2fpasswd' },
  { name: 'double-encoded', path: '/..%252f..%252f..%252fetc%252fpasswd' },
  { name: 'null-byte', path: '/assets/..%00/../../etc/passwd' },
  { name: 'windows-separators', path: '/..\\/..\\/etc/passwd' },
  { name: 'windows-encoded', path: '/..%5c..%5c..%5cetc%5cpasswd' },
]

try {
  execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
} catch {
  /* none */
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

function curlStatusAndBody(urlPath) {
  // --path-as-is: do not let curl collapse ".." before the request is sent
  const out = execFileSync(
    'curl',
    [
      '-sS',
      '--path-as-is',
      '-o',
      '-',
      '-w',
      '\n__HTTP_STATUS__:%{http_code}',
      `${base}${urlPath}`,
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
  )
  const marker = '\n__HTTP_STATUS__:'
  const idx = out.lastIndexOf(marker)
  if (idx < 0) throw new Error('curl status marker missing')
  const body = out.slice(0, idx)
  const status = Number(out.slice(idx + marker.length).trim())
  return { status, body }
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
  await waitFor(`${base}/`)

  // Positive control: legitimate static asset must still be served
  const ok = curlStatusAndBody('/assets/client.js')
  console.log(`positive /assets/client.js → ${ok.status}`)
  if (ok.status !== 200) {
    throw new Error(`positive control expected 200, got ${ok.status}`)
  }
  if (!ok.body.includes('function') && !ok.body.includes('=>') && ok.body.length < 20) {
    throw new Error('positive control body does not look like client.js')
  }

  const results = []
  for (const v of VECTORS) {
    const { status, body } = curlStatusAndBody(v.path)
    results.push({ name: v.name, path: v.path, status })
    console.log(`${v.name} ${v.path} → ${status}`)
    if (status !== 403 && status !== 400) {
      throw new Error(`${v.name}: expected 403 or 400, got ${status}`)
    }
    if (PASSWD_LEAK.test(body)) {
      throw new Error(`${v.name}: response leaked /etc/passwd content`)
    }
  }

  console.log('--- path-traversal results ---')
  for (const r of results) {
    console.log(`${r.name}: ${r.status} (${r.path})`)
  }
  console.log('path-traversal-smoke ok')
} finally {
  killServer()
}
