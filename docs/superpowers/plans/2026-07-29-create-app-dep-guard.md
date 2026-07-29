# Create-app dependency guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `create-avedon-app` template `@avedon/*` ranges aligned with workspace versions, fail CI on drift, and prove scaffolded apps build against packed local packages (catching missing runtime exports like `__contextBegin`).

**Architecture:** A root sync script is the single writer for template ranges, adapter edge range, and compiler’s `@avedon/runtime` peer. Release runs sync after `changeset version`. Pack smoke packs the dependency DAG with `workspace:*` rewritten to `file:` tarballs, scaffolds an app, installs those tarballs, and runs `avedon build`. A compiler unit test asserts codegen’s runtime imports exist on the runtime module.

**Tech Stack:** Node ESM scripts, Vitest, pnpm workspaces, Changesets, existing `e2e/create-pack-smoke.mjs`

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer asks (plan commit steps are optional until then)
- TypeScript stays on 5.x
- English-only docs / changelog notes
- Do not smoke against the public npm registry for unpublished APIs
- Non-avedon template deps (`typescript`, `vite`, `wrangler`, ORM) stay manual
- Spec: `docs/superpowers/specs/2026-07-29-create-app-dep-guard-design.md`

## File map

| Path | Responsibility |
|------|----------------|
| `scripts/sync-create-app-deps.mjs` | Read workspace versions; write template + adapter range + compiler peer; `--check`; optional create-app patch bump |
| `scripts/pack-avedon-tarballs.mjs` | Pack ordered `@avedon/*` + `avedon` + `create-avedon-app` with `workspace:*` → `file:` tarball deps |
| `packages/create-avedon-app/template/package.json` | Scaffolded app dependency ranges (sync-owned) |
| `packages/create-avedon-app/src/apply-adapter.ts` | `ADAPTER_EDGE_RANGE` (sync-owned) |
| `packages/compiler/package.json` | `peerDependencies["@avedon/runtime"]` (sync-owned) |
| `packages/compiler/src/runtime-export-contract.test.ts` | Codegen imports ⊆ runtime exports |
| `e2e/create-pack-smoke.mjs` | Scaffold + tarball install + `avedon build` |
| `package.json` | `sync:create-app-deps`, `changeset:version` scripts |
| `.github/workflows/release.yml` | `version: pnpm changeset:version` |
| `.github/workflows/ci.yml` or `e2e.yml` | Run sync `--check` |
| `memories.md` | Status note |

---

### Task 1: Sync script (`sync-create-app-deps.mjs`)

**Files:**
- Create: `scripts/sync-create-app-deps.mjs`
- Modify: `package.json` (root scripts)
- Modify (via script): `packages/create-avedon-app/template/package.json`, `packages/create-avedon-app/src/apply-adapter.ts`, `packages/compiler/package.json`

**Interfaces:**
- Consumes: workspace `packages/*/package.json` `version` fields
- Produces: CLI `node scripts/sync-create-app-deps.mjs [--check] [--bump-create-app-if-changed]`
  - Exit `0` when OK; exit `1` on `--check` drift
  - Range shape always `^` + exact workspace version (e.g. `0.2.1` → `^0.2.1`)

- [ ] **Step 1: Add the sync script**

Create `scripts/sync-create-app-deps.mjs`:

```js
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

// Prefer cloudflare version; bun must match the same edge line in this repo.
const edgeRange = caret(versionOf('adapter-cloudflare'))
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
  pkg.dependencies = { ...pkg.dependencies, ...expectedTemplateDeps }
  const next = `${JSON.stringify(pkg, null, 2)}\n`
  if (check) return next === before.template
  fs.writeFileSync(templatePath, next)
  return next === before.template
}

function writeAdapter() {
  const re = /const ADAPTER_EDGE_RANGE = '[^']+'/
  if (!re.test(before.adapter)) {
    throw new Error('ADAPTER_EDGE_RANGE const not found in apply-adapter.ts')
  }
  const next = before.adapter.replace(re, `const ADAPTER_EDGE_RANGE = '${edgeRange}'`)
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
  console.error('expected compiler peer @avedon/runtime:', runtimePeer)
  process.exit(1)
}

const changed = !(okTemplate && okAdapter && okCompiler)
console.log('sync-create-app-deps: wrote ranges', expectedTemplateDeps, edgeRange, runtimePeer)

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
```

- [ ] **Step 2: Wire root scripts**

In root `package.json` `scripts`, add:

```json
"sync:create-app-deps": "node scripts/sync-create-app-deps.mjs",
"changeset:version": "changeset version && node scripts/sync-create-app-deps.mjs --bump-create-app-if-changed"
```

- [ ] **Step 3: Run sync once (write mode)**

```bash
node scripts/sync-create-app-deps.mjs
node scripts/sync-create-app-deps.mjs --check
```

Expected: first command may rewrite compiler peer / align any drift; `--check` prints `OK` and exits 0.

- [ ] **Step 4: Commit (only if maintainer asked)**

```bash
git add scripts/sync-create-app-deps.mjs package.json \
  packages/create-avedon-app/template/package.json \
  packages/create-avedon-app/src/apply-adapter.ts \
  packages/compiler/package.json
git commit -m "$(cat <<'EOF'
chore: add create-app dependency sync script

Keep scaffold ranges and compiler runtime peer aligned with workspace versions.
EOF
)"
```

---

### Task 2: CI check + release hook

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `scripts/sync-create-app-deps.mjs --check`, root `pnpm changeset:version`
- Produces: CI fails on template drift; Version Packages PR includes synced ranges

- [ ] **Step 1: Add sync check to CI test job**

In `.github/workflows/ci.yml`, in the `test` job after `pnpm install --frozen-lockfile` (and before or after build — either is fine), add:

```yaml
      - name: Check create-app dependency sync
        run: node scripts/sync-create-app-deps.mjs --check
```

- [ ] **Step 2: Point Release version step at changeset:version**

In `.github/workflows/release.yml`, change the changesets action `version:` input from `pnpm changeset version` to:

```yaml
          version: pnpm changeset:version
```

- [ ] **Step 3: Verify scripts resolve locally**

```bash
pnpm run sync:create-app-deps -- --check
```

Expected: `OK` (pnpm forwards `--check`). If pnpm swallows flags, run `node scripts/sync-create-app-deps.mjs --check` instead — CI uses the node form.

- [ ] **Step 4: Commit (only if maintainer asked)**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml package.json
git commit -m "$(cat <<'EOF'
ci: gate create-app dep sync on PRs and version releases
EOF
)"
```

---

### Task 3: Compiler runtime export contract test

**Files:**
- Create: `packages/compiler/src/runtime-export-contract.test.ts`
- Touch: `packages/compiler/package.json` (peer already from Task 1; keep `workspace:*` dependency)

**Interfaces:**
- Consumes: `compile()` / public compile API used by existing `compile.test.ts`; `@avedon/runtime` namespace exports
- Produces: Vitest that fails if codegen imports a missing runtime binding

- [ ] **Step 1: Write the contract test**

Create `packages/compiler/src/runtime-export-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as runtime from '@avedon/runtime'
import { compile, compileSsr } from './index.js'

function importedRuntimeNames(code: string): string[] {
  const names = new Set<string>()
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]@avedon\/runtime['"]/g
  for (const m of code.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const bit = part.trim()
      if (!bit) continue
      const [left] = bit.split(/\s+as\s+/)
      names.add(left.trim())
    }
  }
  return [...names]
}

describe('runtime export contract', () => {
  it('client and ssr codegen only import existing @avedon/runtime exports', () => {
    const source = `<script>
  import { signal, onMount, setContext } from '@avedon/runtime'
  const n = signal(0)
  onMount(() => {})
  setContext('k', 1)
<\/script>
<button on:click={() => n.set(n.get() + 1)}>{n.get()}</button>`

    const clientOut = compile(source, { filename: 'Contract.ave', hmr: false })
    const ssrOut = compileSsr(source, { filename: 'Contract.ave' })

    for (const out of [clientOut, ssrOut]) {
      const names = importedRuntimeNames(out.code)
      expect(names.length).toBeGreaterThan(0)
      for (const name of names) {
        expect(name in runtime, `missing runtime export: ${name}`).toBe(true)
      }
    }
  })
})
```

Confirm `compile` / `compileSsr` option shapes against `compile.test.ts` if types complain (`hmr` may be optional).

- [ ] **Step 2: Run the test**

```bash
pnpm -F @avedon/compiler test src/runtime-export-contract.test.ts
```

Expected: PASS with current runtime. To sanity-check failure mode, temporarily rename expectation or comment out `__contextBegin` export locally — should FAIL with `missing runtime export: __contextBegin`. Revert that local break.

- [ ] **Step 3: Commit (only if maintainer asked)**

```bash
git add packages/compiler/src/runtime-export-contract.test.ts packages/compiler/package.json
git commit -m "$(cat <<'EOF'
test: assert compiler runtime imports exist on @avedon/runtime
EOF
)"
```

---

### Task 4: Pack tarball helper

**Files:**
- Create: `scripts/pack-avedon-tarballs.mjs`

**Interfaces:**
- Consumes: built `packages/*/dist` (caller runs `pnpm build` first)
- Produces: `packAvedonTarballs(packDir: string): { tarballs: Map<string, string> }`  
  Map keys = package name (`@avedon/runtime`, `avedon`, `create-avedon-app`, …); values = absolute `.tgz` paths  
  Also usable as CLI: `node scripts/pack-avedon-tarballs.mjs <packDir>`

Package order (leaves → dependents):

1. `@avedon/shared` → `packages/shared`
2. `@avedon/runtime` → `packages/runtime`
3. `@avedon/compiler` → `packages/compiler`
4. `@avedon/server` → `packages/server`
5. `@avedon/vite-plugin` → `packages/vite-plugin`
6. `@avedon/adapter-node` → `packages/adapter-node`
7. `create-avedon-app` → `packages/create-avedon-app`
8. `avedon` → `packages/cli`

- [ ] **Step 1: Implement pack helper**

```js
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

export function packAvedonTarballs(packDir) {
  fs.mkdirSync(packDir, { recursive: true })
  const tarballs = new Map()
  const backups = []

  try {
    // Resolve all tarball destination paths from current versions.
    for (const p of PACKAGES) {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, p.dir, 'package.json'), 'utf8'))
      tarballs.set(p.name, path.join(packDir, tarballFileName(p.name, pkg.version)))
    }

    // Rewrite workspace:* → file:<abs.tgz> then pack each package.
    for (const p of PACKAGES) {
      const pkgPath = path.join(root, p.dir, 'package.json')
      const original = fs.readFileSync(pkgPath, 'utf8')
      backups.push({ pkgPath, original })
      const pkg = JSON.parse(original)
      for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        const deps = pkg[field]
        if (!deps) continue
        for (const [dep, range] of Object.entries(deps)) {
          if (range === 'workspace:*' && tarballs.has(dep)) {
            deps[dep] = `file:${tarballs.get(dep)}`
          }
        }
      }
      // Keep peer @avedon/runtime as file: too so npm does not fetch registry.
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('pack-avedon-tarballs.mjs')) {
  const out = process.argv[2]
  if (!out) {
    console.error('Usage: node scripts/pack-avedon-tarballs.mjs <packDir>')
    process.exit(1)
  }
  const { tarballs } = packAvedonTarballs(path.resolve(out))
  for (const [name, file] of tarballs) console.log(name, file)
}
```

Fix the CLI guard to the usual pattern:

```js
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // ...
}
```

- [ ] **Step 2: Smoke the helper**

```bash
pnpm build
PACK=$(mktemp -d)
node scripts/pack-avedon-tarballs.mjs "$PACK"
ls "$PACK"
```

Expected: eight `.tgz` files; workspace `package.json` files unchanged (`git status` clean for those paths).

- [ ] **Step 3: Commit (only if maintainer asked)**

```bash
git add scripts/pack-avedon-tarballs.mjs
git commit -m "$(cat <<'EOF'
chore: add avedon tarball pack helper for create-app smoke
EOF
)"
```

---

### Task 5: Extend `create-pack-smoke` to install + build

**Files:**
- Modify: `e2e/create-pack-smoke.mjs`

**Interfaces:**
- Consumes: `packAvedonTarballs` from `scripts/pack-avedon-tarballs.mjs` (dynamic `import` with file URL)
- Produces: smoke that fails if scaffolded app cannot `avedon build` against packed packages

- [ ] **Step 1: Rewrite create-pack-smoke**

Replace the body of `e2e/create-pack-smoke.mjs` with logic equivalent to:

```js
/**
 * Pack + isolated install + build smoke for create-avedon-app (pre-publish).
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-pack-'))
const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-pack-out-'))

const { packAvedonTarballs } = await import(
  pathToFileURL(path.join(root, 'scripts/pack-avedon-tarballs.mjs')).href
)

try {
  // Ensure packages are built (CI already builds; local may need it).
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })

  const { tarballs } = packAvedonTarballs(packDir)
  const createTgz = tarballs.get('create-avedon-app')
  if (!createTgz || !fs.existsSync(createTgz)) {
    throw new Error('create-avedon-app tarball missing')
  }

  execFileSync('npm', ['install', createTgz], {
    cwd: isolated,
    stdio: 'inherit',
    env: { ...process.env, npm_config_user_agent: 'npm' },
  })

  // Force npm ranges (no monorepo file: rewrite).
  delete process.env.AVEDON_MONOREPO_ROOT

  const create = spawn(
    process.execPath,
    ['node_modules/create-avedon-app/dist/cli.js', 'test-app', '--yes'],
    { cwd: isolated, stdio: 'inherit', env: { ...process.env } },
  )
  const code = await new Promise((resolve) => create.on('close', resolve))
  if (code !== 0) throw new Error('create-avedon-app cli failed')

  const app = path.join(isolated, 'test-app')
  const pkgPath = path.join(app, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (pkg.dependencies.avedon?.startsWith('file:') && !pkg.dependencies.avedon.includes('.tgz')) {
    throw new Error('isolated scaffold must not rewrite deps to monorepo file: packages')
  }

  // Point app at packed tarballs instead of the registry.
  for (const [name, tgz] of tarballs) {
    if (name === 'create-avedon-app') continue
    if (pkg.dependencies?.[name]) pkg.dependencies[name] = tgz
    if (pkg.devDependencies?.[name]) pkg.devDependencies[name] = tgz
  }
  // Ensure transitive compiler/shared are installable if npm flattens oddly:
  pkg.dependencies['@avedon/compiler'] = tarballs.get('@avedon/compiler')
  pkg.dependencies['@avedon/shared'] = tarballs.get('@avedon/shared')
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  execFileSync('npm', ['install'], {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, npm_config_user_agent: 'npm' },
  })

  execFileSync('npx', ['avedon', 'build'], {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env },
  })

  if (!fs.existsSync(path.join(app, 'build')) && !fs.existsSync(path.join(app, 'dist'))) {
    // adapters write to build/; assert at least client or server artefact
    const listing = fs.readdirSync(app)
    if (!listing.some((f) => f === 'build' || f === '.avedon')) {
      throw new Error('avedon build produced no build artefacts')
    }
  }

  console.log('create-pack-smoke ok')
} finally {
  fs.rmSync(isolated, { recursive: true, force: true })
  fs.rmSync(packDir, { recursive: true, force: true })
}
```

Tighten the build artefact check to whatever the node adapter actually emits (inspect `packages/adapter-node` / a local `avedon build` once — typically `build/client` + `build/server.js`). Assert those exact paths.

- [ ] **Step 2: Run pack smoke**

```bash
node e2e/create-pack-smoke.mjs
```

Expected: `create-pack-smoke ok`. Duration may be several minutes (build + packs + install + build).

- [ ] **Step 3: Commit (only if maintainer asked)**

```bash
git add e2e/create-pack-smoke.mjs scripts/pack-avedon-tarballs.mjs
git commit -m "$(cat <<'EOF'
test: build scaffolded app from packed avedon tarballs
EOF
)"
```

---

### Task 6: Memories + spec status

**Files:**
- Modify: `memories.md`
- Modify: `docs/superpowers/specs/2026-07-29-create-app-dep-guard-design.md` (Status → Implemented)

**Interfaces:**
- Consumes: completed Tasks 1–5
- Produces: durable project notes

- [ ] **Step 1: Update memories**

Replace the “awaiting spec review” create-app dep guard bullet with:

```markdown
- **Create-app dep guard (2026-07-29):** `scripts/sync-create-app-deps.mjs` (+ CI `--check`, `pnpm changeset:version` hook); `scripts/pack-avedon-tarballs.mjs` + `e2e/create-pack-smoke` install/build; compiler `runtime-export-contract` + `@avedon/runtime` peer. Spec/plan under `docs/superpowers/{specs,plans}/2026-07-29-create-app-dep-guard*`.
```

- [ ] **Step 2: Mark spec implemented**

In the design spec header, set `**Status:** Implemented (2026-07-29)`.

- [ ] **Step 3: Commit (only if maintainer asked)**

```bash
git add memories.md docs/superpowers/specs/2026-07-29-create-app-dep-guard-design.md \
  docs/superpowers/plans/2026-07-29-create-app-dep-guard.md
git commit -m "$(cat <<'EOF'
docs: mark create-app dep guard implemented
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Sync script writes template ranges | Task 1 |
| Sync writes `ADAPTER_EDGE_RANGE` | Task 1 |
| Sync writes compiler peer | Task 1 |
| `--check` CI gate | Task 2 |
| Release: sync after `changeset version` + create-app patch if needed | Tasks 1–2 |
| Pack smoke: tarballs → install → `avedon build` | Tasks 4–5 |
| Contract test codegen ⊆ runtime exports | Task 3 |
| No public-registry unpublished smoke | Task 5 (file tarballs only) |

## Self-review notes

- Task 3 uses `compile` + `compileSsr` (not a fake `mode` flag).
- Pack helper must always restore `package.json` in `finally` so a failed pack cannot dirty the monorepo.
- `peerDependencies` rewritten to `file:` only inside the pack helper’s temporary mutation — never committed.
