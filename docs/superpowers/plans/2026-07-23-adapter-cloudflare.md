# `@avedon/adapter-cloudflare` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cloudflare adapter stub with a Workers adapter that writes a self-contained `build/` artifact (`client/` assets + SSG HTML, bundled server, `worker.js`, `wrangler.jsonc`) deployable via `wrangler deploy`.

**Architecture:** Mirror `@avedon/adapter-node`’s `adapt(builder)` flow. Emit SSG HTML into `out/client`, copy the Vite SSR server bundle into `out/server/`, generate a Worker `fetch` entry that calls `createHandler`, and write `wrangler.jsonc` with Workers Assets (`ASSETS`) + `nodejs_compat`. No ISR on the edge in v1.

**Tech Stack:** TypeScript, Vitest, `@avedon/shared` / `@avedon/server`, Wrangler 4.x (devDependency or peer for dry-run), Web `Request`/`Response`

**Spec:** `docs/superpowers/specs/2026-07-23-adapter-cloudflare-design.md`

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer explicitly asks (include commit steps but skip until asked)
- TypeScript 5.x only
- English-only docs
- Workers only (not Pages Functions)
- No ISR/KV/R2 regeneration
- No Bun adapter in this plan
- Do not switch the toolchain to the Cloudflare Vite plugin
- Asset-first routing (platform default); Worker handles non-asset requests
- Self-contained `out/` directory so `wrangler deploy --config <out>/wrangler.jsonc` does not depend on `.avedon/` remaining on disk after copy

---

## File map

| Path | Responsibility |
|------|----------------|
| `packages/adapter-cloudflare/src/index.ts` | `cloudflareAdapter`, `adapt()`, path helpers, worker + wrangler emitters |
| `packages/adapter-cloudflare/src/adapt.test.ts` | Unit tests with mock `AdapterBuilder` |
| `packages/adapter-cloudflare/package.json` | Add `@avedon/server` dep; `test` script; optional `wrangler` devDep |
| `packages/adapter-cloudflare/README.md` | Build + deploy + secrets |
| `docs/deployment.md` | Workers guide; remove stub language; note ISR gap |
| `docs/configuration.md` | Show `cloudflareAdapter` example |
| `e2e/cloudflare-adapt-smoke.mjs` | Build fixture / invoke adapt; assert artifact tree |
| `package.json` (root) | Optionally append smoke to `test:smoke` if fast enough |
| `memories.md` | Mark adapter Cloudflare done when shipped |

---

### Task 1: Core `adapt()` — client, SSG, server copy, worker, wrangler

**Files:**
- Modify: `packages/adapter-cloudflare/src/index.ts`
- Create: `packages/adapter-cloudflare/src/adapt.test.ts`
- Modify: `packages/adapter-cloudflare/package.json`

**Interfaces:**
- Consumes: `AdapterBuilder` from `@avedon/shared`; `createHandler` from `@avedon/server` (imported inside generated worker string, not necessarily at adapt-time)
- Produces:
  - `cloudflareAdapter(options?: { out?: string; name?: string }): AdapterInterface`
  - On `adapt(builder)`: writes `out/client/**`, `out/server/index.js` (+ any sibling chunks if present), `out/worker.js`, `out/wrangler.jsonc`
  - Export types: `Adapter`, `Builder` aliases like Node

- [ ] **Step 1: Add failing unit test**

Create `packages/adapter-cloudflare/src/adapt.test.ts`:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { AdapterBuilder } from '@avedon/shared'
import { cloudflareAdapter } from './index.js'

function mockBuilder(tmp: string, serverEntry: string): AdapterBuilder {
  const clientSrc = path.join(tmp, 'src-client')
  fs.mkdirSync(clientSrc, { recursive: true })
  fs.writeFileSync(path.join(clientSrc, 'assets-client.js'), 'console.log(1)')
  fs.writeFileSync(serverEntry, 'export const routes = []; export const appHtml = "<html>%avedon.body%</html>";')

  return {
    getClientDirectory: () => clientSrc,
    getServerEntry: () => serverEntry,
    getSsgPages: () => [
      { path: '/', html: '<html>home</html>' },
      { path: '/docs/intro', html: '<html>intro</html>' },
    ],
    getManifest: () => ({ routes: [] }),
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

describe('cloudflareAdapter.adapt', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-cf-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('writes client, SSG HTML, server copy, worker.js, and wrangler.jsonc', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'server-entry.js')
    const adapter = cloudflareAdapter({ out, name: 'avedon-test' })
    await adapter.adapt(mockBuilder(tmp, serverEntry))

    expect(fs.existsSync(path.join(out, 'client', 'assets-client.js'))).toBe(true)
    expect(fs.readFileSync(path.join(out, 'client', 'index.html'), 'utf8')).toContain('home')
    expect(fs.readFileSync(path.join(out, 'client', 'docs', 'intro', 'index.html'), 'utf8')).toContain(
      'intro',
    )
    expect(fs.existsSync(path.join(out, 'server', 'index.js'))).toBe(true)
    const worker = fs.readFileSync(path.join(out, 'worker.js'), 'utf8')
    expect(worker).toContain('createHandler')
    expect(worker).toContain('./server/index.js')
    expect(worker).toMatch(/export\s+default/)

    const wrangler = JSON.parse(
      fs.readFileSync(path.join(out, 'wrangler.jsonc'), 'utf8').replace(/\/\/.*$/gm, ''),
    )
    expect(wrangler.name).toBe('avedon-test')
    expect(wrangler.main).toBe('./worker.js')
    expect(wrangler.assets.directory).toBe('./client')
    expect(wrangler.assets.binding).toBe('ASSETS')
    expect(wrangler.compatibility_flags).toContain('nodejs_compat')
    expect(wrangler.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not throw the stub error', async () => {
    const out = path.join(tmp, 'build')
    const serverEntry = path.join(tmp, 'server-entry.js')
    await expect(cloudflareAdapter({ out }).adapt(mockBuilder(tmp, serverEntry))).resolves.toBeUndefined()
  })
})
```

Add to `packages/adapter-cloudflare/package.json`:

```json
"scripts": {
  "build": "tsup src/index.ts --format esm --dts --clean",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "test": "vitest run"
},
"dependencies": {
  "@avedon/server": "workspace:*",
  "@avedon/shared": "workspace:*"
}
```

- [ ] **Step 2: Run test — expect fail**

```bash
pnpm install
pnpm -F @avedon/adapter-cloudflare test
```

Expected: FAIL (stub throws or missing outputs).

- [ ] **Step 3: Implement `cloudflareAdapter`**

Replace `packages/adapter-cloudflare/src/index.ts` with an implementation that:

1. Resolves `out` (default `'build'`) and `name` (default `'avedon-app'`).
2. `mkdirp(out)`, `mkdirp(out/client)`, `writeClient(out/client)`.
3. For each `getSsgPages()` entry, write HTML:
   - `/` → `out/client/index.html`
   - `/docs/intro` → `out/client/docs/intro/index.html`
   - Reject path segments that are `..` or empty after split (throw if unsafe).
4. Copy server entry to `out/server/index.js` via `fs.copyFileSync(builder.getServerEntry(), …)`. If the server directory contains other `.js` chunks next to the entry, copy the whole directory (`fs.cpSync` / recursive) from `path.dirname(serverEntry)` → `out/server` so relative chunk imports keep working.
5. Write `out/worker.js` from `workerSource()` (below).
6. Write `out/wrangler.jsonc` from `wranglerSource(name)` (below).

```ts
import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import fs from 'node:fs'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export type CloudflareAdapterOptions = {
  out?: string
  name?: string
}

export function cloudflareAdapter(options: CloudflareAdapterOptions = {}): AdapterInterface {
  const out = options.out ?? 'build'
  const name = options.name ?? 'avedon-app'
  return {
    name: '@avedon/adapter-cloudflare',
    async adapt(builder) {
      const outDir = path.resolve(out)
      const clientDir = path.join(outDir, 'client')
      const serverDir = path.join(outDir, 'server')

      builder.mkdirp(outDir)
      builder.mkdirp(clientDir)
      builder.writeClient(clientDir)

      for (const page of builder.getSsgPages()) {
        const file = ssgHtmlPath(clientDir, page.path)
        builder.mkdirp(path.dirname(file))
        builder.writeFile(file, page.html)
      }

      const serverEntry = builder.getServerEntry()
      builder.mkdirp(serverDir)
      const entryDir = path.dirname(serverEntry)
      // Copy entire SSR output dir so chunk imports resolve under out/server.
      fs.cpSync(entryDir, serverDir, { recursive: true })

      const hasRevalidate = (builder.getManifest().routes as Array<{ render?: string }> | undefined)?.some(
        // Manifest may not include revalidate; warn via SSG pages only if we extend later.
        () => false,
      )
      void hasRevalidate

      builder.writeFile(path.join(outDir, 'worker.js'), workerSource())
      builder.writeFile(path.join(outDir, 'wrangler.jsonc'), wranglerSource(name))
    },
  }
}

export function ssgHtmlPath(clientDir: string, routePath: string): string {
  const normalized = routePath.split('?')[0] || '/'
  if (normalized.includes('\0')) throw new Error('Invalid SSG path')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((p) => p === '..' || p === '.')) throw new Error(`Unsafe SSG path: ${routePath}`)
  if (parts.length === 0) return path.join(clientDir, 'index.html')
  return path.join(clientDir, ...parts, 'index.html')
}

function workerSource(): string {
  return `import { createHandler } from '@avedon/server';
import * as serverApp from './server/index.js';

const routes = serverApp.routes ?? serverApp.default;
const appHtml = serverApp.appHtml;
const clientEntry = '/assets/client.js';

function resolveSession(env) {
  const base = serverApp.session;
  if (!base) return undefined;
  if (base.secret) return base;
  const secret = env.SESSION_SECRET;
  if (!secret) return base;
  return { ...base, secret };
}

export default {
  async fetch(request, env, ctx) {
    const handler = createHandler({
      routes,
      appHtml,
      hooks: serverApp.hooks,
      errorComponent: serverApp.errorComponent,
      notFoundComponent: serverApp.notFoundComponent,
      clientEntry,
      session: resolveSession(env),
    });
    return handler(request);
  },
};
`
}

function wranglerSource(name: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `{
  "name": ${JSON.stringify(name)},
  "main": "./worker.js",
  "compatibility_date": ${JSON.stringify(date)},
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./client",
    "binding": "ASSETS"
  }
}
`
}

export default cloudflareAdapter
```

**Note:** Creating `createHandler` per request is simpler and correct for `env`-dependent session; optimize to module-scope later if profiling warrants (only when secret is static).

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm -F @avedon/adapter-cloudflare test
pnpm -F @avedon/adapter-cloudflare build
```

Expected: PASS; `dist/` updated.

- [ ] **Step 5: Commit (when maintainer asks)**

```bash
git add packages/adapter-cloudflare
git commit -m "$(cat <<'EOF'
feat(adapter-cloudflare): emit Workers artifact with assets and wrangler config.

EOF
)"
```

---

### Task 2: Docs + ISR warning

**Files:**
- Modify: `packages/adapter-cloudflare/README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/configuration.md`
- Modify: `packages/adapter-cloudflare/src/index.ts` (build warning when manifest routes include revalidate — if manifest lacks it, scan is optional; instead document only)

**Interfaces:**
- Consumes: Task 1 artifact layout
- Produces: user-facing deploy instructions

- [ ] **Step 1: Rewrite adapter README**

Replace stub README with:

```markdown
# @avedon/adapter-cloudflare

Cloudflare Workers adapter for avedon. Emits a Wrangler-deployable `build/` directory: static assets + SSG HTML, SSR Worker entry, and \`wrangler.jsonc\`.

## Config

\`\`\`ts
import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'my-avedon-app' }),
}
\`\`\`

## Build and deploy

\`\`\`bash
pnpm build          # avedon build → build/
cd build && wrangler deploy
\`\`\`

Requires Wrangler 4+ and a Cloudflare account.

### Sessions

Set the Worker secret:

\`\`\`bash
wrangler secret put SESSION_SECRET
\`\`\`

If \`server-entry\` exports \`session\` without \`secret\`, the generated Worker fills \`secret\` from \`env.SESSION_SECRET\`.

## Limits (v1)

- **ISR / \`revalidate\`:** not supported on Workers — SSG HTML is fixed until the next deploy.
- Pages Functions are not used; this adapter targets Workers + Assets.
\`\`\`

- [ ] **Step 2: Update `docs/deployment.md`**

Replace the “Other platforms” stub paragraph with a **Cloudflare Workers** section that mirrors the README (config snippet, `wrangler deploy`, `SESSION_SECRET`, ISR gap). Keep Node as the default “quick” path at the top; add Workers as a first-class second target.

- [ ] **Step 3: Update `docs/configuration.md`**

After the Node adapter example, add:

```ts
import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'my-avedon-app' }),
}
```

- [ ] **Step 4: Emit build warning for revalidate**

In `adapt()`, after writing SSG pages, if `builder.getManifest()` has a `routes` array, and any route object has a truthy `revalidate` field when present, `console.warn` once:

`[@avedon/adapter-cloudflare] revalidate/ISR is not supported on Workers in v1; SSG pages are static until redeploy.`

If the CLI manifest does not currently include `revalidate`, extend the CLI manifest in the same task:

In `packages/cli/src/cli.ts` `getManifest`:

```ts
getManifest: () => ({
  routes: flattenRoutes(routes).map((r) => ({
    path: r.path,
    render: r.render ?? 'ssr',
    revalidate: r.revalidate,
  })),
}),
```

- [ ] **Step 5: Commit (when maintainer asks)**

```bash
git add packages/adapter-cloudflare/README.md packages/adapter-cloudflare/src/index.ts \
  docs/deployment.md docs/configuration.md packages/cli/src/cli.ts
git commit -m "$(cat <<'EOF'
docs: document Cloudflare Workers adapter and ISR gap.

EOF
)"
```

---

### Task 3: Smoke — real build with cloudflare adapter

**Files:**
- Create: `e2e/cloudflare-adapt-smoke.mjs`
- Modify: root `package.json` (`test:smoke` append)
- Modify: `memories.md`

**Interfaces:**
- Consumes: built `@avedon/adapter-cloudflare` + `examples/basic-app` (temporarily swap config or use a one-off config file)
- Produces: CI-safe smoke that does not require Cloudflare auth

- [ ] **Step 1: Write smoke script**

Create `e2e/cloudflare-adapt-smoke.mjs` that:

1. Builds workspace packages if needed (assume `pnpm build` already run in CI).
2. Writes a temporary `avedon.config.cloudflare.mjs` inside `examples/basic-app` **or** copies the app to a temp dir — prefer temp dir to avoid dirtying the example:

```js
/**
 * Cloudflare adapter artifact smoke (no Cloudflare account required).
 */
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples/basic-app')
const cli = path.join(root, 'packages/cli/dist/cli.js')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-cf-smoke-'))
fs.cpSync(example, tmp, { recursive: true })
fs.writeFileSync(
  path.join(tmp, 'avedon.config.ts'),
  `import { cloudflareAdapter } from '@avedon/adapter-cloudflare'
export default { adapter: cloudflareAdapter({ out: 'build', name: 'avedon-cf-smoke' }) }
`,
)

const build = spawn(process.execPath, [cli, 'build'], { cwd: tmp, stdio: 'inherit' })
const code = await new Promise((resolve) => build.on('close', resolve))
if (code !== 0) throw new Error('cloudflare adapt smoke: avedon build failed')

const out = path.join(tmp, 'build')
for (const rel of ['worker.js', 'wrangler.jsonc', 'client/index.html', 'server/index.js']) {
  if (!fs.existsSync(path.join(out, rel))) throw new Error('missing ' + rel)
}
const wrangler = fs.readFileSync(path.join(out, 'wrangler.jsonc'), 'utf8')
if (!wrangler.includes('"ASSETS"')) throw new Error('wrangler missing ASSETS binding')
if (!fs.readFileSync(path.join(out, 'worker.js'), 'utf8').includes('createHandler')) {
  throw new Error('worker missing createHandler')
}

// Optional dry-run when wrangler is installed; ignore auth errors.
try {
  execSync('pnpm exec wrangler deploy --dry-run --config wrangler.jsonc', {
    cwd: out,
    stdio: 'pipe',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '' },
  })
  console.log('wrangler dry-run ok')
} catch {
  console.log('wrangler dry-run skipped or failed (ok for smoke without CF credentials)')
}

fs.rmSync(tmp, { recursive: true, force: true })
console.log('cloudflare-adapt-smoke ok')
```

Ensure `examples/basic-app` / workspace can resolve `@avedon/adapter-cloudflare` (already a monorepo package; temp copy may need the root `node_modules` — run build with `NODE_PATH` or keep the smoke **in-repo** by writing config to a temp path and invoking build with `cwd: example` after backing up `avedon.config.ts`).

**Safer in-repo variant (prefer this if temp copy breaks resolution):**

```js
const example = path.join(root, 'examples/basic-app')
const configPath = path.join(example, 'avedon.config.ts')
const backup = fs.readFileSync(configPath, 'utf8')
try {
  fs.writeFileSync(configPath, cloudflareConfigSource)
  const build = spawn(process.execPath, [cli, 'build'], { cwd: example, stdio: 'inherit' })
  // …assertions on examples/basic-app/build/**
} finally {
  fs.writeFileSync(configPath, backup)
  fs.rmSync(path.join(example, 'build'), { recursive: true, force: true })
}
```

- [ ] **Step 2: Wire into `test:smoke`**

In root `package.json`, append `&& node e2e/cloudflare-adapt-smoke.mjs` to `test:smoke`.

- [ ] **Step 3: Run smoke**

```bash
pnpm build
node e2e/cloudflare-adapt-smoke.mjs
```

Expected: `cloudflare-adapt-smoke ok`.

- [ ] **Step 4: Update memories**

```markdown
9b. **@avedon/adapter-cloudflare** — done (2026-07-23): Workers + Assets; SSG; no ISR; spec/plan under `docs/superpowers/{specs,plans}/2026-07-23-adapter-cloudflare*`
9c. **Next: @avedon/adapter-bun**
```

- [ ] **Step 5: Commit (when maintainer asks)**

```bash
git add e2e/cloudflare-adapt-smoke.mjs package.json memories.md \
  docs/superpowers/specs/2026-07-23-adapter-cloudflare-design.md \
  docs/superpowers/plans/2026-07-23-adapter-cloudflare.md
git commit -m "$(cat <<'EOF'
test(e2e): add Cloudflare adapter artifact smoke.

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Workers + ASSETS | Task 1 wrangler emitter |
| SSG HTML in assets | Task 1 |
| Self-contained out / worker + createHandler | Task 1 |
| No ISR; document gap | Task 2 |
| Docs deployment/configuration | Task 2 |
| Testing unit + light integration | Task 1 + Task 3 |
| Session via secret | Task 1 worker `resolveSession` + Task 2 docs |
| Success: stub gone | Task 1 |

No placeholders. Bun / Pages Functions / CF Vite plugin explicitly out of scope.
