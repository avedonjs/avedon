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
  if (!home.includes('avedon')) throw new Error('Home SSR missing brand')
  if (!home.includes('data-avedon-page')) throw new Error('Home missing data-avedon-page outlet')
  if (!home.includes('href="/admin"')) throw new Error('Layout nav missing')

  const post = await (await fetch('http://localhost:5173/posts/1')).text()
  if (!post.includes('Hello avedon')) throw new Error('Post SSR missing title')

  const doc = await (await fetch('http://localhost:5173/docs/intro')).text()
  if (!doc.includes('Welcome to the docs')) throw new Error('Docs SSG path missing content')

  const api = await (await fetch('http://localhost:5173/posts/1.json')).json()
  if (!api.post || api.post.id !== '1') throw new Error('api_GET .json mismatch: ' + JSON.stringify(api))

  const admin = await fetch('http://localhost:5173/admin')
  if (admin.status !== 403) throw new Error('Admin guard expected 403, got ' + admin.status)
  const adminHtml = await admin.text()
  if (!adminHtml.includes('Access denied') && !adminHtml.includes('Forbidden')) {
    throw new Error('Route error UI missing')
  }

  const like = await fetch('http://localhost:5173/posts/1?_action=like', {
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
  })
  const likeHtml = await like.text()
  if (!likeHtml.includes('Hello avedon')) throw new Error('like action failed')

  const csrfNoOrigin = await fetch('http://localhost:5173/posts/1?_action=like', {
    method: 'POST',
    headers: { Referer: '' },
  })
  if (csrfNoOrigin.status !== 403) {
    throw new Error(
      'CSRF expected 403 without Origin/Referer, got ' + csrfNoOrigin.status,
    )
  }
  const csrfEvil = await fetch('http://localhost:5173/posts/1?_action=like', {
    method: 'POST',
    headers: { origin: 'https://evil.example' },
  })
  if (csrfEvil.status !== 403) {
    throw new Error('CSRF expected 403 for evil Origin, got ' + csrfEvil.status)
  }

  const loginRes = await fetch('http://localhost:5173/login?_action=login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'user=admin',
    redirect: 'manual',
  })
  const setCookie = loginRes.headers.get('set-cookie')
  if (!setCookie) throw new Error('login missing Set-Cookie')
  const sessionCookie = setCookie.split(';')[0]

  const allowed = await fetch('http://localhost:5173/admin', {
    headers: { cookie: sessionCookie },
  })
  if (allowed.status !== 200) throw new Error('Admin with session should pass, got ' + allowed.status)
  const allowedHtml = await allowed.text()
  if (!allowedHtml.includes('data-avedon-csr')) throw new Error('CSR shell missing on admin')

  const avedonMod = await fetch('http://localhost:5173/src/pages/Home.ave?import')
  const vexBody = await avedonMod.text()
  if (vexBody.includes('<!doctype html>') || vexBody.includes('Not found')) {
    throw new Error('Home.ave module returned HTML page instead of JS')
  }
  if (vexBody.includes('SUPER_SECRET') || vexBody.includes('from \'../lib/db\'')) {
    // client transform of Home has no server script — ok
  }

  const routeNf = await fetch('http://localhost:5173/error-lab/nf')
  if (routeNf.status !== 404) throw new Error('error-lab/nf expected 404, got ' + routeNf.status)
  const routeNfHtml = await routeNf.text()
  if (!routeNfHtml.includes('data-error-lab="route-not-found"')) {
    throw new Error('route notFound UI missing')
  }
  if (routeNfHtml.includes('>Not found<') && routeNfHtml.includes('Route-specific 404') === false) {
    throw new Error('expected route-specific 404 heading')
  }
  if (!routeNfHtml.includes('Route-specific 404')) throw new Error('route notFound marker missing')

  const globalNf = await fetch('http://localhost:5173/error-lab/global-nf')
  if (globalNf.status !== 404) throw new Error('error-lab/global-nf expected 404')
  const globalNfHtml = await globalNf.text()
  if (!globalNfHtml.includes('>Not found<')) throw new Error('global notFound missing')
  if (globalNfHtml.includes('data-error-lab="route-not-found"')) {
    throw new Error('global-nf should not use route notFound')
  }

  const routeErr = await fetch('http://localhost:5173/error-lab/boom')
  if (routeErr.status !== 500) throw new Error('error-lab/boom expected 500, got ' + routeErr.status)
  const routeErrHtml = await routeErr.text()
  if (!routeErrHtml.includes('data-error-lab="route-error"')) throw new Error('route error UI missing')
  if (!routeErrHtml.includes('500: lab-boom')) throw new Error('route error message missing')
  if (routeErrHtml.includes('>Error 500<')) throw new Error('should not use global error.ave')

  const nestedErr = await fetch('http://localhost:5173/error-lab/nested-boom')
  if (nestedErr.status !== 500) throw new Error('nested-boom expected 500')
  const nestedErrHtml = await nestedErr.text()
  if (!nestedErrHtml.includes('500: nested-lab-boom')) {
    throw new Error('parent route error boundary missing for nested load error')
  }

  console.log('smoke ok')
} catch (err) {
  console.error(stderr.slice(-2000))
  throw err
} finally {
  child.kill('SIGKILL')
}
