/**
 * Adapter smoke: www Cloudflare dogfood + staticAdapter fail-closed on basic-app.
 * Also verifies staticAdapter happy path by temporarily swapping www config.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(root, 'packages/cli/dist/cli.js')

function runBuild(cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'build'], { cwd, stdio: 'pipe' })
    let err = ''
    child.stderr.on('data', (c) => {
      err += c
    })
    child.stdout.on('data', (c) => {
      err += c
    })
    child.on('close', (code) => resolve({ code, err }))
  })
}

async function runWwwPrebuild() {
  const pre = spawn(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['-F', 'www', 'run', 'prebuild'],
    { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' },
  )
  return new Promise((resolve) => {
    let err = ''
    pre.stderr.on('data', (c) => {
      err += c
    })
    pre.stdout.on('data', (c) => {
      err += c
    })
    pre.on('close', (code) => resolve({ code, err }))
  })
}

const www = path.join(root, 'apps/www')
const wwwBuild = path.join(www, 'build')
const wwwConfig = path.join(www, 'avedon.config.ts')
const wwwConfigBackup = fs.readFileSync(wwwConfig, 'utf8')

fs.rmSync(wwwBuild, { recursive: true, force: true })
fs.rmSync(path.join(www, '.avedon'), { recursive: true, force: true })

const preOut = await runWwwPrebuild()
if (preOut.code !== 0) {
  throw new Error('static-adapt-smoke: www prebuild failed\n' + preOut.err)
}

// --- Cloudflare dogfood (current www config) ---
const wwwResult = await runBuild(www)
if (wwwResult.code !== 0) {
  throw new Error('static-adapt-smoke: www CF build failed\n' + wwwResult.err)
}
for (const rel of ['client/index.html', 'client/assets/client.js', 'worker.js', 'wrangler.jsonc']) {
  if (!fs.existsSync(path.join(wwwBuild, rel))) {
    throw new Error('static-adapt-smoke: missing ' + rel + ' from cloudflare adapter')
  }
}
if (fs.existsSync(path.join(wwwBuild, 'server.js'))) {
  throw new Error('static-adapt-smoke: unexpected Node server.js from cloudflare adapter')
}

// --- Static adapter happy path (temporary www config) ---
fs.rmSync(wwwBuild, { recursive: true, force: true })
fs.rmSync(path.join(www, '.avedon'), { recursive: true, force: true })
fs.writeFileSync(
  wwwConfig,
  `import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build', notFoundHtml: true }),
}
`,
)
try {
  const staticWww = await runBuild(www)
  if (staticWww.code !== 0) {
    throw new Error('static-adapt-smoke: www staticAdapter build failed\n' + staticWww.err)
  }
  if (!fs.existsSync(path.join(wwwBuild, 'client/index.html'))) {
    throw new Error('static-adapt-smoke: static build missing client/index.html')
  }
  if (!fs.existsSync(path.join(wwwBuild, 'client/404.html'))) {
    throw new Error('static-adapt-smoke: static build missing client/404.html')
  }
  if (fs.existsSync(path.join(wwwBuild, 'worker.js'))) {
    throw new Error('static-adapt-smoke: unexpected worker.js from static adapter')
  }
  if (fs.existsSync(path.join(wwwBuild, 'server.js'))) {
    throw new Error('static-adapt-smoke: unexpected server.js from static adapter')
  }
} finally {
  fs.writeFileSync(wwwConfig, wwwConfigBackup)
}

// --- Fail path: basic-app has SSR routes ---
const example = path.join(root, 'examples/basic-app')
const configPath = path.join(example, 'avedon.config.ts')
const backup = fs.readFileSync(configPath, 'utf8')
const staticConfig = `import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build' }),
}
`
try {
  fs.rmSync(path.join(example, 'build'), { recursive: true, force: true })
  fs.rmSync(path.join(example, '.avedon'), { recursive: true, force: true })
  fs.writeFileSync(configPath, staticConfig)
  const fail = await runBuild(example)
  if (fail.code === 0) {
    throw new Error('static-adapt-smoke: expected basic-app + staticAdapter to fail')
  }
  if (!fail.err.includes('@avedon/adapter-static')) {
    throw new Error(
      'static-adapt-smoke: fail output missing @avedon/adapter-static\n' + fail.err,
    )
  }
} finally {
  fs.writeFileSync(configPath, backup)
  fs.rmSync(path.join(example, 'build'), { recursive: true, force: true })
}

console.log('static-adapt-smoke ok')
