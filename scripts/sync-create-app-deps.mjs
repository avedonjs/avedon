import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const bumpCreateApp = process.argv.includes('--bump-create-app-if-changed')

function readPkg(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
}

function caret(version) {
  return `^${version}`
}

function versionOf(dirName) {
  return readPkg(`packages/${dirName}/package.json`).version
}

const expectedTemplateDeps = {
  '@avedon/adapter-node': caret(versionOf('adapter-node')),
  '@avedon/runtime': caret(versionOf('runtime')),
  '@avedon/server': caret(versionOf('server')),
  '@avedon/vite-plugin': caret(versionOf('vite-plugin')),
  avedon: caret(versionOf('cli')),
}

// Prefer cloudflare version; bun shares the same edge line in this repo.
const edgeRange = caret(versionOf('adapter-cloudflare'))
const staticRange = caret(versionOf('adapter-static'))
const runtimePeer = caret(versionOf('runtime'))

const templatePath = path.join(root, 'packages/create-avedon-app/template/package.json')
const adapterPath = path.join(root, 'packages/create-avedon-app/src/apply-adapter.ts')
const compilerPath = path.join(root, 'packages/compiler/package.json')

function snapshot(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

const before = {
  template: snapshot(templatePath),
  adapter: snapshot(adapterPath),
  compiler: snapshot(compilerPath),
}

function writeTemplate() {
  const pkg = JSON.parse(before.template)
  pkg.dependencies ??= {}
  for (const [name, range] of Object.entries(expectedTemplateDeps)) {
    pkg.dependencies[name] = range
  }
  const next = `${JSON.stringify(pkg, null, 2)}\n`
  if (check) return next === before.template
  fs.writeFileSync(templatePath, next)
  return next === before.template
}

function writeAdapter() {
  const re = /const ADAPTER_EDGE_RANGE = '[^']+'/
  const reStatic = /const ADAPTER_STATIC_RANGE = '[^']+'/
  if (!re.test(before.adapter)) {
    throw new Error('ADAPTER_EDGE_RANGE const not found in apply-adapter.ts')
  }
  if (!reStatic.test(before.adapter)) {
    throw new Error('ADAPTER_STATIC_RANGE const not found in apply-adapter.ts')
  }
  const next = before.adapter
    .replace(re, `const ADAPTER_EDGE_RANGE = '${edgeRange}'`)
    .replace(reStatic, `const ADAPTER_STATIC_RANGE = '${staticRange}'`)
  if (check) return next === before.adapter
  fs.writeFileSync(adapterPath, next)
  return next === before.adapter
}

function writeCompilerPeer() {
  const pkg = JSON.parse(before.compiler)
  pkg.peerDependencies = {
    ...(pkg.peerDependencies ?? {}),
    '@avedon/runtime': runtimePeer,
  }
  const next = `${JSON.stringify(pkg, null, 2)}\n`
  if (check) return next === before.compiler
  fs.writeFileSync(compilerPath, next)
  return next === before.compiler
}

const okTemplate = writeTemplate()
const okAdapter = writeAdapter()
const okCompiler = writeCompilerPeer()

if (check) {
  if (okTemplate && okAdapter && okCompiler) {
    console.log('sync-create-app-deps: OK')
    process.exit(0)
  }
  console.error('sync-create-app-deps: drift detected. Run: node scripts/sync-create-app-deps.mjs')
  console.error('expected template deps:', expectedTemplateDeps)
  console.error('expected ADAPTER_EDGE_RANGE:', edgeRange)
  console.error('expected ADAPTER_STATIC_RANGE:', staticRange)
  console.error('expected compiler peer @avedon/runtime:', runtimePeer)
  process.exit(1)
}

const changed = !(okTemplate && okAdapter && okCompiler)
console.log('sync-create-app-deps: wrote ranges', expectedTemplateDeps, {
  ADAPTER_EDGE_RANGE: edgeRange,
  ADAPTER_STATIC_RANGE: staticRange,
  peerRuntime: runtimePeer,
})

if (bumpCreateApp && changed) {
  const createAppRel = 'packages/create-avedon-app/package.json'
  const createAppPath = path.join(root, createAppRel)
  let headVersion = null
  try {
    headVersion = JSON.parse(
      execFileSync('git', ['show', `HEAD:${createAppRel}`], { encoding: 'utf8' }),
    ).version
  } catch {
    headVersion = null
  }
  const pkg = readPkg(createAppRel)
  if (headVersion == null || pkg.version === headVersion) {
    const [maj, min, pat] = pkg.version.split('.').map(Number)
    pkg.version = `${maj}.${min}.${pat + 1}`
    fs.writeFileSync(createAppPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.log(`sync-create-app-deps: bumped create-avedon-app to ${pkg.version}`)
  }
}
