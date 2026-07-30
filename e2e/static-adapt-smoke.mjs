/**
 * Static adapter smoke: www happy path + basic-app must fail closed.
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

// --- Happy path: www (SSG-only) ---
const www = path.join(root, 'apps/www')
const wwwBuild = path.join(www, 'build')
fs.rmSync(wwwBuild, { recursive: true, force: true })
fs.rmSync(path.join(www, '.avedon'), { recursive: true, force: true })

const wwwResult = await runBuild(www)
if (wwwResult.code !== 0) {
  throw new Error('static-adapt-smoke: www build failed\n' + wwwResult.err)
}
for (const rel of ['client/index.html', 'client/assets/client.js']) {
  if (!fs.existsSync(path.join(wwwBuild, rel))) {
    throw new Error('static-adapt-smoke: missing ' + rel)
  }
}
if (fs.existsSync(path.join(wwwBuild, 'server.js'))) {
  throw new Error('static-adapt-smoke: unexpected build/server.js from static adapter')
}
if (fs.existsSync(path.join(wwwBuild, 'worker.js'))) {
  throw new Error('static-adapt-smoke: unexpected worker.js')
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
