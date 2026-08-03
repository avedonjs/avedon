import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Keep private packages on the same version as the publishable lockstep train.
 * Source of truth: `@avedon/compiler` (member of the Changesets `fixed` group).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readPkg(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
}

function writePkg(rel, pkg) {
  fs.writeFileSync(path.join(root, rel), `${JSON.stringify(pkg, null, 2)}\n`)
}

const version = readPkg('packages/compiler/package.json').version
const privatePkgs = ['packages/vscode-avedon/package.json']

for (const rel of privatePkgs) {
  const pkg = readPkg(rel)
  if (pkg.version === version) {
    console.log(`sync-private-package-versions: ${pkg.name} already ${version}`)
    continue
  }
  pkg.version = version
  writePkg(rel, pkg)
  console.log(`sync-private-package-versions: ${pkg.name} → ${version}`)
}
