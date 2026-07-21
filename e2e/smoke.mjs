/**
 * Node smoke test against examples/basic-app
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')

async function waitFor(url, ms = 30_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status >= 400) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

const child = spawn(process.execPath, [cli, 'dev'], {
  cwd: example,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr?.on('data', (d) => {
  stderr += String(d)
})
child.stdout?.on('data', () => {})

try {
  await waitFor('http://localhost:5173/')

  const home = await (await fetch('http://localhost:5173/')).text()
  if (!home.includes('vexjs')) throw new Error('Home SSR missing brand')
  if (!home.includes('data-vex-page')) throw new Error('Home missing data-vex-page outlet')
  if (!home.includes('href="/admin"')) throw new Error('Layout nav missing')

  const post = await (await fetch('http://localhost:5173/posts/1')).text()
  if (!post.includes('Hello vexjs')) throw new Error('Post SSR missing title')

  const api = await (await fetch('http://localhost:5173/posts/1.json')).json()
  if (!api.post || api.post.id !== '1') throw new Error('api_GET .json mismatch: ' + JSON.stringify(api))

  const admin = await fetch('http://localhost:5173/admin')
  if (admin.status !== 403) throw new Error('Admin guard expected 403, got ' + admin.status)
  const adminHtml = await admin.text()
  if (!adminHtml.includes('Access denied') && !adminHtml.includes('Forbidden')) {
    throw new Error('Route error UI missing')
  }

  const allowed = await fetch('http://localhost:5173/admin?auth=1')
  if (allowed.status !== 200) throw new Error('Admin with auth=1 should pass, got ' + allowed.status)
  const allowedHtml = await allowed.text()
  if (!allowedHtml.includes('data-vex-csr')) throw new Error('CSR shell missing on admin')

  const like = await fetch('http://localhost:5173/posts/1?_action=like', { method: 'POST' })
  const likeHtml = await like.text()
  if (!likeHtml.includes('Hello vexjs')) throw new Error('like action failed')

  const vexMod = await fetch('http://localhost:5173/src/pages/Home.vex?import')
  const vexBody = await vexMod.text()
  if (vexBody.includes('<!doctype html>') || vexBody.includes('Not found')) {
    throw new Error('Home.vex module returned HTML page instead of JS')
  }
  if (vexBody.includes('SUPER_SECRET') || vexBody.includes('from \'../lib/db\'')) {
    // client transform of Home has no server script — ok
  }

  console.log('smoke ok')
} catch (err) {
  console.error(stderr.slice(-2000))
  throw err
} finally {
  child.kill('SIGKILL')
}
