import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PACKAGES = [
  { name: '@avedon/shared', dir: 'packages/shared' },
  { name: '@avedon/runtime', dir: 'packages/runtime' },
  { name: '@avedon/compiler', dir: 'packages/compiler' },
  { name: '@avedon/server', dir: 'packages/server' },
  { name: '@avedon/vite-plugin', dir: 'packages/vite-plugin' },
  { name: '@avedon/adapter-node', dir: 'packages/adapter-node' },
  { name: 'create-avedon-app', dir: 'packages/create-avedon-app' },
  { name: 'avedon', dir: 'packages/cli' },
]

function tarballFileName(name, version) {
  const base = name.startsWith('@') ? name.slice(1).replace('/', '-') : name
  return `${base}-${version}.tgz`
}

/**
 * Pack ordered avedon packages with workspace:* rewritten to file: tarballs.
 * Always restores package.json files in finally.
 * @param {string} packDir
 * @returns {{ tarballs: Map<string, string> }}
 */
export function packAvedonTarballs(packDir) {
  fs.mkdirSync(packDir, { recursive: true })
  /** @type {Map<string, string>} */
  const tarballs = new Map()
  /** @type {{ pkgPath: string, original: string }[]} */
  const backups = []

  try {
    for (const p of PACKAGES) {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, p.dir, 'package.json'), 'utf8'))
      tarballs.set(p.name, path.join(packDir, tarballFileName(p.name, pkg.version)))
    }

    for (const p of PACKAGES) {
      const pkgPath = path.join(root, p.dir, 'package.json')
      const original = fs.readFileSync(pkgPath, 'utf8')
      backups.push({ pkgPath, original })
      const pkg = JSON.parse(original)
      for (const field of ['dependencies', 'optionalDependencies']) {
        const deps = pkg[field]
        if (!deps) continue
        for (const [dep, range] of Object.entries(deps)) {
          if ((range === 'workspace:*' || String(range).startsWith('workspace:')) && tarballs.has(dep)) {
            deps[dep] = `file:${tarballs.get(dep)}`
          }
        }
      }
      if (pkg.peerDependencies?.['@avedon/runtime'] && tarballs.has('@avedon/runtime')) {
        pkg.peerDependencies['@avedon/runtime'] = `file:${tarballs.get('@avedon/runtime')}`
      }
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
      execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
        cwd: path.join(root, p.dir),
        stdio: 'inherit',
      })
    }
    return { tarballs }
  } finally {
    for (const { pkgPath, original } of backups.reverse()) {
      fs.writeFileSync(pkgPath, original)
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2]
  if (!out) {
    console.error('Usage: node scripts/pack-avedon-tarballs.mjs <packDir>')
    process.exit(1)
  }
  const { tarballs } = packAvedonTarballs(path.resolve(out))
  for (const [name, file] of tarballs) console.log(name, file)
}
