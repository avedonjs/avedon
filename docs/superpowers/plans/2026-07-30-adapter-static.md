# `@avedon/adapter-static` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship fail-closed `@avedon/adapter-static` that emits only `out/client/` (assets + SSG HTML), wire `create-avedon-app --adapter=static`, and dogfood on `apps/www`.

**Architecture:** Mirror Cloudflare/Node `adapt()` client+SSG write path, but skip all server/worker artifacts. Validate the build manifest in `adapt()` (hard fail on non-SSG, actions, API, `revalidate`, or empty SSG pages). Extend the CLI manifest so adapters can see `hasActions` / `hasApi`.

**Tech Stack:** TypeScript, Vitest, tsup, pnpm workspaces, existing `AdapterBuilder` / `AdapterInterface` from `@avedon/shared`

**Spec:** `docs/superpowers/specs/2026-07-30-adapter-static-design.md`

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer explicitly asks (still prepare clean commits per task when asked)
- TypeScript 5.x only
- English-only docs / README / changeset
- Hard fail (throw), never warn-and-continue, for forbidden route features
- Do not write `server.js`, `server/`, or `worker.js` from this adapter
- Output layout: `out/client/**` (default `out` = `build`)
- New package first version: `0.1.0`
- User preference: no force-push; no hook skips

---

## File map

| Path | Responsibility |
|------|----------------|
| `packages/adapter-static/package.json` | Package metadata, scripts, deps |
| `packages/adapter-static/tsconfig.json` | Extends base; exclude tests from emit |
| `packages/adapter-static/vitest.config.ts` | `include: ['src/**/*.test.ts']` |
| `packages/adapter-static/src/index.ts` | `staticAdapter`, `assertStaticCompatible`, `ssgHtmlPath` |
| `packages/adapter-static/src/adapt.test.ts` | Happy path + each fail case |
| `packages/adapter-static/README.md` | Usage + fail-closed rules |
| `packages/cli/src/cli.ts` | Manifest: add `hasActions`, `hasApi` |
| `packages/create-avedon-app/src/types.ts` | `AdapterChoice` += `'static'` |
| `packages/create-avedon-app/src/options.ts` | Parse/prompt `static` |
| `packages/create-avedon-app/src/apply-adapter.ts` | Wire static deps + config |
| `packages/create-avedon-app/src/index.ts` | `LOCAL_PKG_DIRS` + next-steps copy |
| `packages/create-avedon-app/src/*.test.ts` | Adapter static cases |
| `scripts/sync-create-app-deps.mjs` | Sync `ADAPTER_STATIC_RANGE` from package version |
| `apps/www/avedon.config.ts` | `staticAdapter` |
| `apps/www/package.json` | Dep swap |
| `docs/deployment.md` | Static section |
| `docs/configuration.md` | Example |
| `docs/cli.md` / `docs/quick-start.md` | `--adapter=static` |
| `docs/publishing.md` | List new package + Trusted Publisher follow-up |
| `e2e/static-adapt-smoke.mjs` | www happy path + basic-app fail path |
| Root `package.json` | Append smoke script |
| `.changeset/adapter-static.md` | Changeset for new package + consumers |
| `memories.md` | Status when shipped |
| Spec header Plan link | Point at this plan |

---

### Task 1: `@avedon/adapter-static` package (TDD)

**Files:**
- Create: `packages/adapter-static/package.json`
- Create: `packages/adapter-static/tsconfig.json`
- Create: `packages/adapter-static/vitest.config.ts`
- Create: `packages/adapter-static/src/adapt.test.ts`
- Create: `packages/adapter-static/src/index.ts`
- Create: `packages/adapter-static/README.md`

**Interfaces:**
- Consumes: `AdapterBuilder`, `AdapterInterface` from `@avedon/shared`
- Consumes (manifest route shape): `{ path?: string; render?: string; revalidate?: number; hasActions?: boolean; hasApi?: boolean }`
- Produces:
  - `export type StaticAdapterOptions = { out?: string }`
  - `export function staticAdapter(options?: StaticAdapterOptions): AdapterInterface`
  - `export function assertStaticCompatible(manifest: Record<string, unknown>): void`
  - `export function ssgHtmlPath(clientDir: string, routePath: string): string`

- [ ] **Step 1: Scaffold package files**

`packages/adapter-static/package.json`:

```json
{
  "name": "@avedon/adapter-static",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@avedon/shared": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.9"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/avedonjs/avedon.git",
    "directory": "packages/adapter-static"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

`packages/adapter-static/tsconfig.json` — copy from `packages/adapter-cloudflare/tsconfig.json`.

`packages/adapter-static/vitest.config.ts` — copy from `packages/adapter-cloudflare/vitest.config.ts`.

Run: `pnpm install` from repo root (link workspace package).

- [ ] **Step 2: Write failing unit tests**

Create `packages/adapter-static/src/adapt.test.ts`:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdapterBuilder } from '@avedon/shared'
import { assertStaticCompatible, ssgHtmlPath, staticAdapter } from './index.js'

type ManifestRoute = {
  path: string
  render?: string
  revalidate?: number
  hasActions?: boolean
  hasApi?: boolean
}

function mockBuilder(
  tmp: string,
  opts: {
    routes?: ManifestRoute[]
    ssgPages?: Array<{ path: string; html: string }>
  } = {},
): AdapterBuilder {
  const clientSrc = path.join(tmp, 'src-client')
  fs.mkdirSync(clientSrc, { recursive: true })
  fs.writeFileSync(path.join(clientSrc, 'assets-client.js'), 'console.log(1)')
  const serverEntry = path.join(tmp, 'ssr', 'index.js')
  fs.mkdirSync(path.dirname(serverEntry), { recursive: true })
  fs.writeFileSync(serverEntry, 'export const routes = []')

  const routes = opts.routes ?? [
    { path: '/', render: 'ssg' },
    { path: '/docs/intro', render: 'ssg' },
  ]
  const ssgPages = opts.ssgPages ?? [
    { path: '/', html: '<html>home</html>' },
    { path: '/docs/intro', html: '<html>intro</html>' },
  ]

  return {
    getClientDirectory: () => clientSrc,
    getServerEntry: () => serverEntry,
    getSsgPages: () => ssgPages,
    getManifest: () => ({ routes }),
    writeClient(dest) {
      fs.mkdirSync(dest, { recursive: true })
      fs.copyFileSync(path.join(clientSrc, 'assets-client.js'), path.join(dest, 'assets-client.js'))
    },
    writeFile(file, contents) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, contents)
    },
    mkdirp(dir) {
      fs.mkdirSync(dir, { recursive: true })
    },
  }
}

describe('ssgHtmlPath', () => {
  it('maps / and nested paths', () => {
    expect(ssgHtmlPath('/out', '/')).toBe(path.join('/out', 'index.html'))
    expect(ssgHtmlPath('/out', '/docs/intro')).toBe(path.join('/out', 'docs', 'intro', 'index.html'))
  })

  it('rejects traversal', () => {
    expect(() => ssgHtmlPath('/out', '/../../etc/passwd')).toThrow(/Unsafe SSG path/)
  })
})

describe('assertStaticCompatible', () => {
  it('accepts ssg-only routes', () => {
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/', render: 'ssg' }],
      }),
    ).not.toThrow()
  })

  it('rejects missing render (defaults to ssr)', () => {
    expect(() => assertStaticCompatible({ routes: [{ path: '/x' }] })).toThrow(
      /@avedon\/adapter-static/,
    )
  })

  it('rejects ssr and csr', () => {
    expect(() =>
      assertStaticCompatible({ routes: [{ path: '/a', render: 'ssr' }] }),
    ).toThrow(/\/a/)
    expect(() =>
      assertStaticCompatible({ routes: [{ path: '/b', render: 'csr' }] }),
    ).toThrow(/\/b/)
  })

  it('rejects actions, api, and revalidate', () => {
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/a', render: 'ssg', hasActions: true }],
      }),
    ).toThrow(/actions/)
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/b', render: 'ssg', hasApi: true }],
      }),
    ).toThrow(/api/)
    expect(() =>
      assertStaticCompatible({
        routes: [{ path: '/c', render: 'ssg', revalidate: 60 }],
      }),
    ).toThrow(/revalidate/)
  })
})

describe('staticAdapter.adapt', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-static-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('writes client + SSG HTML only', async () => {
    const out = path.join(tmp, 'build')
    await staticAdapter({ out }).adapt(mockBuilder(tmp))

    expect(fs.existsSync(path.join(out, 'client', 'assets-client.js'))).toBe(true)
    expect(fs.readFileSync(path.join(out, 'client', 'index.html'), 'utf8')).toContain('home')
    expect(
      fs.readFileSync(path.join(out, 'client', 'docs', 'intro', 'index.html'), 'utf8'),
    ).toContain('intro')
    expect(fs.existsSync(path.join(out, 'server.js'))).toBe(false)
    expect(fs.existsSync(path.join(out, 'server'))).toBe(false)
    expect(fs.existsSync(path.join(out, 'worker.js'))).toBe(false)
  })

  it('fails when getSsgPages is empty', async () => {
    const out = path.join(tmp, 'build')
    await expect(
      staticAdapter({ out }).adapt(
        mockBuilder(tmp, {
          routes: [{ path: '/', render: 'ssg' }],
          ssgPages: [],
        }),
      ),
    ).rejects.toThrow(/no SSG pages/i)
  })

  it('fails on incompatible manifest before writing server artifacts', async () => {
    const out = path.join(tmp, 'build')
    await expect(
      staticAdapter({ out }).adapt(
        mockBuilder(tmp, { routes: [{ path: '/', render: 'ssr' }] }),
      ),
    ).rejects.toThrow(/@avedon\/adapter-static/)
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `pnpm -F @avedon/adapter-static test`

Expected: FAIL (module / exports missing).

- [ ] **Step 4: Implement `src/index.ts`**

```ts
import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export type StaticAdapterOptions = {
  out?: string
}

type ManifestRoute = {
  path?: string
  render?: string
  revalidate?: number
  hasActions?: boolean
  hasApi?: boolean
}

export function ssgHtmlPath(clientDir: string, routePath: string): string {
  const normalized = routePath.split('?')[0] || '/'
  if (normalized.includes('\0')) throw new Error('Invalid SSG path')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((p) => p === '..' || p === '.')) {
    throw new Error(`Unsafe SSG path: ${routePath}`)
  }
  if (parts.length === 0) return path.join(clientDir, 'index.html')
  return path.join(clientDir, ...parts, 'index.html')
}

export function assertStaticCompatible(manifest: Record<string, unknown>): void {
  const routes = (manifest.routes ?? []) as ManifestRoute[]
  for (const route of routes) {
    const p = route.path ?? '(unknown)'
    const render = route.render ?? 'ssr'
    if (render !== 'ssg') {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} has render: '${render}' — only render: 'ssg' is allowed.`,
      )
    }
    if (route.hasActions) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} defines actions — not supported for static export.`,
      )
    }
    if (route.hasApi) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} defines api handlers — not supported for static export.`,
      )
    }
    if (route.revalidate != null) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} sets revalidate — ISR requires a server adapter.`,
      )
    }
  }
}

export function staticAdapter(options: StaticAdapterOptions = {}): AdapterInterface {
  const out = options.out ?? 'build'
  return {
    name: '@avedon/adapter-static',
    async adapt(builder) {
      assertStaticCompatible(builder.getManifest())

      const pages = builder.getSsgPages()
      if (pages.length === 0) {
        throw new Error(
          '[@avedon/adapter-static] No SSG pages emitted — ensure every route uses render: \'ssg\' and getStaticPaths where needed.',
        )
      }

      const outDir = path.resolve(out)
      const clientDir = path.join(outDir, 'client')
      builder.mkdirp(outDir)
      builder.mkdirp(clientDir)
      builder.writeClient(clientDir)

      for (const page of pages) {
        const file = ssgHtmlPath(clientDir, page.path)
        builder.mkdirp(path.dirname(file))
        builder.writeFile(file, page.html)
      }
    },
  }
}

export default staticAdapter
```

`packages/adapter-static/README.md`:

```markdown
# @avedon/adapter-static

Fail-closed static export for Avedon. Writes only `build/client` (hashed assets + SSG HTML). Deploy that folder to Cloudflare Pages, Netlify, GitHub Pages, S3/CDN, etc.

## Config

\`\`\`ts
import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build' }),
}
\`\`\`

## Requirements

Every route must use `render: 'ssg'` (with `getStaticPaths` / `entries` for param routes). The build **fails** if any route uses SSR/CSR, form `actions`, `api` / `api_*`, or `revalidate`.

## Deploy

\`\`\`bash
pnpm build
# upload ./build/client
\`\`\`

Example (Cloudflare Pages):

\`\`\`bash
wrangler pages deploy ./build/client --project-name=my-app
\`\`\`
```

- [ ] **Step 5: Run tests + build — expect PASS**

```bash
pnpm -F @avedon/adapter-static test
pnpm -F @avedon/adapter-static build
pnpm -F @avedon/adapter-static typecheck
```

Expected: all green.

- [ ] **Step 6: Commit (when asked)**

```bash
git add packages/adapter-static
git commit -m "$(cat <<'EOF'
feat(adapter-static): add fail-closed static export adapter

Emit only out/client assets and SSG HTML; reject SSR/CSR/actions/API/ISR.
EOF
)"
```

---

### Task 2: CLI manifest — `hasActions` / `hasApi`

**Files:**
- Modify: `packages/cli/src/cli.ts` (manifest mapping near `getManifest`)
- Optional test: if CLI has no unit harness for this, rely on static smoke fail-path; otherwise add a tiny pure helper test

**Interfaces:**
- Consumes: flattened `Routes` from server entry (existing)
- Produces: each manifest route includes `hasActions: boolean`, `hasApi: boolean`

- [ ] **Step 1: Add helpers next to the builder in `packages/cli/src/cli.ts`**

```ts
function routeHasActions(route: { actions?: Record<string, unknown> }): boolean {
  return route.actions != null && Object.keys(route.actions).length > 0
}

function routeHasApi(route: Record<string, unknown>): boolean {
  const api = route.api
  if (api != null && typeof api === 'object' && Object.keys(api as object).length > 0) {
    return true
  }
  for (const key of Object.keys(route)) {
    if (key.startsWith('api_') && route[key] != null) return true
  }
  return false
}
```

- [ ] **Step 2: Extend `getManifest` mapping**

Replace the routes map inside `getManifest` with:

```ts
getManifest: () => ({
  routes: flattenRoutes(routes).map((r) => ({
    path: r.path,
    render: r.render ?? 'ssr',
    revalidate: r.revalidate,
    hasActions: routeHasActions(r),
    hasApi: routeHasApi(r as unknown as Record<string, unknown>),
  })),
}),
```

- [ ] **Step 3: Build CLI**

Run: `pnpm -F avedon build` (or `pnpm -F @avedon/cli` — package name is `avedon` under `packages/cli`)

Expected: success.

- [ ] **Step 4: Commit (when asked)**

```bash
git add packages/cli/src/cli.ts
git commit -m "$(cat <<'EOF'
feat(cli): expose hasActions/hasApi on adapter build manifest

Allow static adapter to fail closed on form actions and API routes.
EOF
)"
```

---

### Task 3: `create-avedon-app --adapter=static`

**Files:**
- Modify: `packages/create-avedon-app/src/types.ts`
- Modify: `packages/create-avedon-app/src/options.ts`
- Modify: `packages/create-avedon-app/src/apply-adapter.ts`
- Modify: `packages/create-avedon-app/src/index.ts`
- Modify: `packages/create-avedon-app/src/options.test.ts`
- Modify: `packages/create-avedon-app/src/scaffold.test.ts` (or apply-adapter tests if separate)
- Modify: `scripts/sync-create-app-deps.mjs`
- Modify: `packages/create-avedon-app/README.md` (adapter list)

**Interfaces:**
- Consumes: `staticAdapter` package name `@avedon/adapter-static`
- Produces: `AdapterChoice` includes `'static'`; `applyAdapter(..., 'static', …)` rewrites config/deps

- [ ] **Step 1: Extend types + parse/prompt (failing tests first)**

In `options.test.ts` add:

```ts
it('parses --adapter=static', () => {
  expect(parseCreateArgs(['--adapter=static']).adapter).toBe('static')
})
```

Update invalid-adapter expectation string to include `static`:

`expected node|cloudflare|bun|static`

In `types.ts`:

```ts
export type AdapterChoice = 'node' | 'cloudflare' | 'bun' | 'static'
```

In `options.ts`:

```ts
const ADAPTERS = new Set<AdapterChoice>(['node', 'cloudflare', 'bun', 'static'])
```

Update the error message to `(expected node|cloudflare|bun|static)`.

In the TTY `p.select` options array, add:

```ts
{ value: 'static' as const, label: 'Static (SSG only)' },
```

- [ ] **Step 2: `applyAdapter` for static**

In `apply-adapter.ts`, change the if/else chain so `cloudflare` / `bun` / `static` are explicit (do not let static fall into the bun branch).

Add:

```ts
/** First publish line for @avedon/adapter-static. */
const ADAPTER_STATIC_RANGE = '^0.1.0'
```

Static branch:

```ts
if (adapter === 'static') {
  pkg.dependencies['@avedon/adapter-static'] = ADAPTER_STATIC_RANGE
  delete pkg.scripts.start
  delete pkg.scripts.preview
  fs.writeFileSync(
    path.join(appDir, 'avedon.config.ts'),
    `import { staticAdapter } from '@avedon/adapter-static'\n\n` +
      `export default {\n` +
      `  adapter: staticAdapter({ out: 'build' }),\n` +
      `}\n`,
  )
}
```

Keep cloudflare/bun branches unchanged. Structure:

```ts
if (adapter === 'cloudflare') { ... }
else if (adapter === 'bun') { ... }
else if (adapter === 'static') { ... }
```

- [ ] **Step 3: Monorepo link + next-steps**

In `index.ts` `LOCAL_PKG_DIRS` add:

```ts
'@avedon/adapter-static': 'adapter-static',
```

In `formatNextSteps` (or equivalent), add:

```ts
if (adapter === 'static') {
  extra += '\n  Production: pnpm build — then deploy the build/client folder to any static host'
  extra += '\n  Note: only render: \'ssg\' routes are allowed (no SSR/CSR/actions/API/ISR)'
}
```

- [ ] **Step 4: Scaffold test**

Add a test mirroring the cloudflare scaffold case:

```ts
it('applies static adapter', () => {
  // scaffold or call applyAdapter on a temp template copy
  expect(cfg).toContain("from '@avedon/adapter-static'")
  expect(cfg).toContain('staticAdapter')
  expect(pkg.dependencies['@avedon/adapter-static']).toMatch(/^(\^0\.1\.|file:)/)
  expect(pkg.dependencies['@avedon/adapter-node']).toBeUndefined()
})
```

Follow the existing cloudflare test’s setup (temp dir + `scaffold` / `applyAdapter`).

- [ ] **Step 5: Sync script**

In `scripts/sync-create-app-deps.mjs`, after `ADAPTER_EDGE_RANGE` handling, also sync static:

```ts
const staticRange = caret(versionOf('adapter-static'))
```

In `writeAdapter`, also replace:

```ts
const reStatic = /const ADAPTER_STATIC_RANGE = '[^']+'/
if (!reStatic.test(before.adapter)) {
  throw new Error('ADAPTER_STATIC_RANGE const not found in apply-adapter.ts')
}
const next = before.adapter
  .replace(re, `const ADAPTER_EDGE_RANGE = '${edgeRange}'`)
  .replace(reStatic, `const ADAPTER_STATIC_RANGE = '${staticRange}'`)
```

Ensure `--check` compares the full rewritten file.

Run: `node scripts/sync-create-app-deps.mjs` then `node scripts/sync-create-app-deps.mjs --check`

- [ ] **Step 6: Run create-app tests**

```bash
pnpm -F create-avedon-app test
```

Expected: PASS.

- [ ] **Step 7: Commit (when asked)**

```bash
git add packages/create-avedon-app scripts/sync-create-app-deps.mjs
git commit -m "$(cat <<'EOF'
feat(create-avedon-app): add --adapter=static

Scaffold staticAdapter config and dependency for SSG-only apps.
EOF
)"
```

---

### Task 4: www dogfood

**Files:**
- Modify: `apps/www/avedon.config.ts`
- Modify: `apps/www/package.json`
- Modify: `apps/www/README.md` (mention static adapter if it references node)

- [ ] **Step 1: Switch config**

`apps/www/avedon.config.ts`:

```ts
import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build' }),
}
```

- [ ] **Step 2: Switch dependency**

In `apps/www/package.json` dependencies:

- Remove: `"@avedon/adapter-node": "workspace:*"`
- Add: `"@avedon/adapter-static": "workspace:*"`

Run: `pnpm install`

- [ ] **Step 3: Build www**

```bash
pnpm -F www build
```

Expected: Build complete; `apps/www/build/client/index.html` exists; no requirement for `build/server.js` for deploy (CLI may still emit `build/server/` before adapt — that is OK; Pages continues to deploy `./build/client` only).

Assert:

```bash
test -f apps/www/build/client/index.html
test -f apps/www/build/client/assets/client.js
```

`pages:deploy` script stays: `wrangler pages deploy ./build/client ...`

- [ ] **Step 4: Commit (when asked)**

```bash
git add apps/www
git commit -m "$(cat <<'EOF'
feat(www): dogfood @avedon/adapter-static

Docs site is SSG-only; deploy path remains build/client.
EOF
)"
```

---

### Task 5: Docs, smoke, changeset, memories

**Files:**
- Modify: `docs/deployment.md`
- Modify: `docs/configuration.md`
- Modify: `docs/cli.md`
- Modify: `docs/quick-start.md`
- Modify: `docs/publishing.md`
- Modify: `docs/superpowers/specs/2026-07-30-adapter-static-design.md` (Plan link)
- Create: `e2e/static-adapt-smoke.mjs`
- Modify: root `package.json` (`test:smoke`)
- Create: `.changeset/adapter-static.md`
- Modify: `memories.md`

- [ ] **Step 1: Docs**

`docs/deployment.md` — update intro to include Static; add section **before** or **after** Node:

```markdown
## Static

Use `@avedon/adapter-static` for fully static hosts (Cloudflare Pages, Netlify, GitHub Pages, S3/CDN).

### Config

\`\`\`ts
import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build' }),
}
\`\`\`

### Build and deploy

\`\`\`bash
pnpm build
# deploy the build/client directory
wrangler pages deploy ./build/client --project-name=my-app
\`\`\`

### Limits

- **Only `render: 'ssg'`** — SSR, CSR, form `actions`, `api` / `api_*`, and `revalidate` cause a hard build failure.
- No Node/Bun/Workers runtime; there is nothing to `avedon start`.
```

Also update the opening paragraph list of adapters and the scaffold sentence to mention `--adapter=static`.

`docs/configuration.md` — add static example alongside cloudflare/node.

`docs/cli.md` + `docs/quick-start.md` — change `--adapter=node|cloudflare|bun` to include `static`.

`docs/publishing.md` — add `@avedon/adapter-static` to the package list; note Trusted Publisher must be configured on npm before the first OIDC publish of this package.

Spec header: set  
`**Plan:** \`docs/superpowers/plans/2026-07-30-adapter-static.md\``

- [ ] **Step 2: Smoke test**

Create `e2e/static-adapt-smoke.mjs`:

```js
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
```

Ensure `examples/basic-app/package.json` can resolve `@avedon/adapter-static` (add `workspace:*` dep if missing — basic-app already lists cloudflare; add static the same way).

Root `package.json` `test:smoke` — append `&& node e2e/static-adapt-smoke.mjs`.

- [ ] **Step 3: Changeset**

`.changeset/adapter-static.md`:

```markdown
---
'@avedon/adapter-static': minor
'create-avedon-app': minor
'avedon': patch
---

Add `@avedon/adapter-static` for fail-closed SSG export (`build/client` only). Create-app gains `--adapter=static`; CLI manifest exposes `hasActions`/`hasApi` for the static gate.
```

(If changeset bot requires only published packages, omit private `www`. `avedon` = CLI package name.)

- [ ] **Step 4: Run verification**

```bash
pnpm -F @avedon/adapter-static test
pnpm -F create-avedon-app test
pnpm build
node e2e/static-adapt-smoke.mjs
```

Expected: all green.

- [ ] **Step 5: Update memories + commit (when asked)**

`memories.md` Status bullet:

```markdown
- **adapter-static (2026-07-30):** `@avedon/adapter-static` shipped — fail-closed SSG export; create-app `--adapter=static`; www dogfood. Spec/plan under `docs/superpowers/{specs,plans}/2026-07-30-adapter-static*`.
```

Remove or replace the earlier “design pending plan” bullet.

```bash
git add docs e2e/static-adapt-smoke.mjs package.json examples/basic-app/package.json \
  .changeset/adapter-static.md memories.md \
  docs/superpowers/specs/2026-07-30-adapter-static-design.md
git commit -m "$(cat <<'EOF'
docs: document adapter-static and add adapt smoke

Wire smoke into test:smoke; changeset for the new adapter release train.
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `staticAdapter` + `out/client` only | Task 1 |
| Hard fail SSR/CSR/actions/API/revalidate | Task 1 (+ Task 2 for actions/API visibility) |
| Empty SSG pages fail | Task 1 |
| `ssgHtmlPath` safety | Task 1 |
| create-app `--adapter=static` | Task 3 |
| www dogfood | Task 4 |
| docs deployment/configuration/cli | Task 5 |
| e2e smoke + test:smoke | Task 5 |
| Changeset + publishing note | Task 5 |
| Trusted Publisher OIDC | Docs follow-up only (Task 5 `publishing.md`) — not automated |

## Self-review notes

- Manifest previously lacked `actions`/`api` — Task 2 closes that gap so the fail-closed policy is real in production builds, not only unit mocks.
- CLI may still write `build/server/` before `adapt()`; static adapter must not add `server.js`/`worker.js`. Smoke asserts absence of those adapter outputs; do not fail solely because Vite SSR outDir exists under `build/server/` (www smoke checks `server.js` / `worker.js` only). If implementers want a cleaner tree later, that is a CLI follow-up (non-goal).
- `applyAdapter` must use `else if` for static so it never hits the bun branch.
