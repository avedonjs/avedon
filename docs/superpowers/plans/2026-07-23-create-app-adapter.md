# Create-app Adapter Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `create-avedon-app` / `avedon create` choose production adapter (`node` | `cloudflare` | `bun`) via TTY select or `--adapter=`, rewriting config, deps, scripts, and next-steps on one base template.

**Architecture:** Same add-on pattern as Tailwind/ORM: pure `applyAdapter(dest, adapter, { name })` filesystem transform after monorepo `file:` link; `resolveCreateOptions` owns flags/prompts; default remains `node`.

**Tech Stack:** TypeScript, Vitest, `@clack/prompts`, existing `@avedon/adapter-*` packages, optional `wrangler` devDependency for Cloudflare scaffolds.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-create-app-adapter-design.md`
- Default adapter: **`node`** (`--yes` / non-TTY / omitted options)
- Cloudflare scripts: `start` and `deploy` = `cd build && wrangler deploy`
- Bun scripts: `start` and `preview` = `bun run build/server.js`
- Cloudflare Worker `name`: scaffold project name; template placeholder already uses `__APP_NAME__` for package name
- Version pins: same caret as other `@avedon/*` in template (currently `^0.1.0`); `wrangler`: `^4.113.0`
- Do not require Bun or live Wrangler deploy in CI
- Stay on `main`; commit only when the user asks (skip commit steps unless asked)

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/create-avedon-app/src/types.ts` | Add `AdapterChoice`; extend options/result types |
| `packages/create-avedon-app/src/options.ts` | Parse `--adapter=`; TTY select; defaults |
| `packages/create-avedon-app/src/options.test.ts` | Flag / resolve tests for adapter |
| `packages/create-avedon-app/src/apply-adapter.ts` | Config + package.json transform per adapter |
| `packages/create-avedon-app/src/apply-adapter.test.ts` | Unit tests for transform (optional if covered in scaffold.test) |
| `packages/create-avedon-app/src/index.ts` | Wire `applyAdapter`, monorepo map, `formatNextSteps` |
| `packages/create-avedon-app/src/scaffold.test.ts` | Scaffold asserts per adapter + next-steps |
| `packages/create-avedon-app/README.md` | Document `--adapter` |
| `docs/cli.md`, `docs/quick-start.md`, `docs/deployment.md` | Flag table + scaffold cross-link |

---

### Task 1: Types + CLI options (`--adapter` + prompt)

**Files:**
- Modify: `packages/create-avedon-app/src/types.ts`
- Modify: `packages/create-avedon-app/src/options.ts`
- Modify: `packages/create-avedon-app/src/options.test.ts`

**Interfaces:**
- Produces:
  - `export type AdapterChoice = 'node' | 'cloudflare' | 'bun'`
  - `ScaffoldOptions.adapter?: AdapterChoice`
  - `ScaffoldResult.adapter: AdapterChoice`
  - `CreateOptions.adapter: AdapterChoice`
  - `ParsedCreateArgs.adapter?: AdapterChoice`
  - `parseCreateArgs` / `resolveCreateOptions` include `adapter` (default `'node'`)

- [ ] **Step 1: Write the failing tests** — extend `options.test.ts`:

```ts
it('parses --adapter=', () => {
  expect(parseCreateArgs(['--adapter=node']).adapter).toBe('node')
  expect(parseCreateArgs(['--adapter=cloudflare']).adapter).toBe('cloudflare')
  expect(parseCreateArgs(['--adapter=bun']).adapter).toBe('bun')
})

it('rejects invalid --adapter', () => {
  expect(() => parseCreateArgs(['--adapter=deno'])).toThrow(/Invalid --adapter/)
})

it('defaults adapter to node with --yes', async () => {
  const opts = await resolveCreateOptions(['--yes'], { stdinIsTTY: true })
  expect(opts).toEqual({
    name: 'my-avedon-app',
    adapter: 'node',
    tailwind: false,
    orm: 'none',
  })
})

it('honors --adapter without prompting', async () => {
  const opts = await resolveCreateOptions(['shop', '--adapter=bun', '--orm=none'], {
    stdinIsTTY: true,
  })
  expect(opts.adapter).toBe('bun')
  expect(opts.name).toBe('shop')
})
```

Also update existing `parseCreateArgs` / `resolveCreateOptions` expectations that omit `adapter` so they expect `adapter: undefined` on parse and `adapter: 'node'` on resolve.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm -F create-avedon-app exec vitest run src/options.test.ts
```

Expected: FAIL (adapter not parsed / not on result)

- [ ] **Step 3: Implement types + options**

`types.ts` — add:

```ts
export type AdapterChoice = 'node' | 'cloudflare' | 'bun'
```

Add `adapter?: AdapterChoice` to `ScaffoldOptions`; `adapter: AdapterChoice` to `ScaffoldResult` and `CreateOptions`.

`options.ts` — mirror ORM parsing:

```ts
const ADAPTERS = new Set<AdapterChoice>(['node', 'cloudflare', 'bun'])

// in parseCreateArgs loop:
if (arg.startsWith('--adapter=')) {
  const value = arg.slice('--adapter='.length) as AdapterChoice
  if (!ADAPTERS.has(value)) {
    throw new Error(`Invalid --adapter=${value} (expected node|cloudflare|bun)`)
  }
  adapter = value
  continue
}
```

Include `adapter` on returned `ParsedCreateArgs`.

In `resolveCreateOptions` forceDefaults branch:

```ts
adapter: parsed.adapter ?? 'node',
```

On TTY, after name (before or after Tailwind — **after name, before Tailwind**):

```ts
let adapter = parsed.adapter
if (adapter === undefined) {
  const answered = await p.select({
    message: 'Production adapter?',
    options: [
      { value: 'node' as const, label: 'Node' },
      { value: 'cloudflare' as const, label: 'Cloudflare Workers' },
      { value: 'bun' as const, label: 'Bun' },
    ],
    initialValue: 'node' as const,
  })
  if (p.isCancel(answered)) process.exit(0)
  adapter = answered as AdapterChoice
}
```

Return `{ name, adapter, tailwind, orm }`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm -F create-avedon-app exec vitest run src/options.test.ts
```

Expected: PASS

---

### Task 2: `applyAdapter` + monorepo link + `scaffoldApp` wiring

**Files:**
- Create: `packages/create-avedon-app/src/apply-adapter.ts`
- Modify: `packages/create-avedon-app/src/index.ts`
- Modify: `packages/create-avedon-app/src/scaffold.test.ts`

**Interfaces:**
- Consumes: `AdapterChoice`, app `name`
- Produces: `export function applyAdapter(appDir: string, adapter: AdapterChoice, opts: { name: string }): void`
  - `node` → no-op
  - `cloudflare` / `bun` → rewrite config + deps + scripts as below
- `LOCAL_PKG_DIRS` gains `@avedon/adapter-cloudflare` → `adapter-cloudflare`, `@avedon/adapter-bun` → `adapter-bun`
- `scaffoldApp` calls `applyAdapter` after monorepo link, before ORM/Tailwind; result includes `adapter`

- [ ] **Step 1: Write the failing scaffold tests** — add to `scaffold.test.ts`:

```ts
it('returns adapter node by default', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'defaults-adapter')
  const result = scaffoldApp(app)
  expect(result.adapter).toBe('node')
  const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
  expect(cfg).toContain('@avedon/adapter-node')
})

it('scaffolds cloudflare adapter config deps and scripts', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'cf-app')
  scaffoldApp(app, { name: 'cf-app', adapter: 'cloudflare' })
  const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
  expect(cfg).toContain("from '@avedon/adapter-cloudflare'")
  expect(cfg).toContain('cloudflareAdapter')
  expect(cfg).toContain("name: 'cf-app'")
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  expect(pkg.dependencies['@avedon/adapter-cloudflare']).toBeTruthy()
  expect(pkg.dependencies['@avedon/adapter-node']).toBeUndefined()
  expect(pkg.devDependencies.wrangler).toBeTruthy()
  expect(pkg.scripts.start).toBe('cd build && wrangler deploy')
  expect(pkg.scripts.deploy).toBe('cd build && wrangler deploy')
})

it('scaffolds bun adapter config deps and scripts', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'bun-app')
  scaffoldApp(app, { name: 'bun-app', adapter: 'bun' })
  const cfg = fs.readFileSync(path.join(app, 'avedon.config.ts'), 'utf8')
  expect(cfg).toContain("from '@avedon/adapter-bun'")
  expect(cfg).toContain('bunAdapter')
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  expect(pkg.dependencies['@avedon/adapter-bun']).toBeTruthy()
  expect(pkg.dependencies['@avedon/adapter-node']).toBeUndefined()
  expect(pkg.scripts.start).toBe('bun run build/server.js')
  expect(pkg.scripts.preview).toBe('bun run build/server.js')
})
```

Update `returns default addon flags when options omitted` to also `expect(result.adapter).toBe('node')`.

- [ ] **Step 2: Run scaffold tests — expect FAIL**

```bash
pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts
```

Expected: FAIL (`adapter` missing / apply not implemented)

- [ ] **Step 3: Implement `apply-adapter.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import type { AdapterChoice } from './types.js'

const AVEDON_DEP = '^0.1.0'
const WRANGLER_DEP = '^4.113.0'

export function applyAdapter(
  appDir: string,
  adapter: AdapterChoice,
  opts: { name: string },
): void {
  if (adapter === 'node') return

  const pkgPath = path.join(appDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  pkg.dependencies ??= {}
  pkg.devDependencies ??= {}
  pkg.scripts ??= {}

  delete pkg.dependencies['@avedon/adapter-node']

  if (adapter === 'cloudflare') {
    pkg.dependencies['@avedon/adapter-cloudflare'] = AVEDON_DEP
    pkg.devDependencies.wrangler = WRANGLER_DEP
    pkg.scripts.start = 'cd build && wrangler deploy'
    pkg.scripts.deploy = 'cd build && wrangler deploy'
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { cloudflareAdapter } from '@avedon/adapter-cloudflare'\n\n` +
        `export default {\n` +
        `  adapter: cloudflareAdapter({ out: 'build', name: ${JSON.stringify(opts.name)} }),\n` +
        `}\n`,
    )
  } else {
    // bun
    pkg.dependencies['@avedon/adapter-bun'] = AVEDON_DEP
    pkg.scripts.start = 'bun run build/server.js'
    pkg.scripts.preview = 'bun run build/server.js'
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { bunAdapter } from '@avedon/adapter-bun'\n\n` +
        `export default {\n` +
        `  adapter: bunAdapter({ out: 'build' }),\n` +
        `}\n`,
    )
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
```

- [ ] **Step 4: Wire `index.ts`**

1. Import `applyAdapter`.
2. Extend `LOCAL_PKG_DIRS`:

```ts
'@avedon/adapter-cloudflare': 'adapter-cloudflare',
'@avedon/adapter-bun': 'adapter-bun',
```

3. `normalizeOptions` include `adapter: options?.adapter ?? 'node'` (and for string second arg, `adapter: 'node'`).
4. After monorepo link:

```ts
applyAdapter(dest, opts.adapter, { name: opts.name })
```

(If monorepo link runs first, it only rewrites packages already in `dependencies`. For cloudflare/bun, `applyAdapter` adds deps **after** link — so call **applyAdapter before link**, or **link after applyAdapter**. Spec order was link then applyAdapter; that breaks `file:` for new adapter deps.

**Locked order for this plan (fixes the gap):**

```
copy → applyAdapter → monorepo link → orm → tailwind
```

So new adapter deps exist before `linkScaffoldToMonorepo` rewrites them to `file:`.)

5. Return `adapter: opts.adapter` from `scaffoldApp`.

- [ ] **Step 5: Run scaffold tests — expect PASS**

```bash
pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts
```

Expected: PASS

- [ ] **Step 6 (optional assert):** With `AVEDON_MONOREPO_ROOT` set to repo root, scaffold `--adapter=cloudflare` and expect `pkg.dependencies['@avedon/adapter-cloudflare']` to start with `file:`.

---

### Task 3: `formatNextSteps` + docs

**Files:**
- Modify: `packages/create-avedon-app/src/index.ts` (`formatNextSteps`)
- Modify: `packages/create-avedon-app/src/scaffold.test.ts`
- Modify: `packages/create-avedon-app/README.md`
- Modify: `docs/cli.md`
- Modify: `docs/quick-start.md`
- Modify: `docs/deployment.md` (short note under intro or each adapter)

**Interfaces:**
- Consumes: `ScaffoldResult.adapter`
- Produces: extra next-step lines for cloudflare / bun

- [ ] **Step 1: Failing next-steps tests**

```ts
it('mentions cloudflare deploy next steps', () => {
  const steps = formatNextSteps({
    dest: '/tmp/x',
    name: 'cf-app',
    packageManager: 'pnpm',
    adapter: 'cloudflare',
    tailwind: false,
    orm: 'none',
  })
  expect(steps).toMatch(/wrangler|deploy/i)
  expect(steps).toMatch(/SESSION_SECRET/)
})

it('mentions bun run next steps', () => {
  const steps = formatNextSteps({
    dest: '/tmp/x',
    name: 'bun-app',
    packageManager: 'pnpm',
    adapter: 'bun',
    tailwind: false,
    orm: 'none',
  })
  expect(steps).toMatch(/bun run build\/server\.js/)
})
```

Update any existing `formatNextSteps` fixtures to include `adapter: 'node'`.

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts
```

- [ ] **Step 3: Implement next-steps extras**

After install/dev lines, append:

```ts
if (adapter === 'cloudflare') {
  extra += '\n  Production: pnpm build && pnpm start  (cd build && wrangler deploy)'
  extra += '\n  Set SESSION_SECRET: wrangler secret put SESSION_SECRET'
  extra += '\n  Note: ISR / revalidate is not supported on Workers'
}
if (adapter === 'bun') {
  extra += '\n  Production: pnpm build && bun run build/server.js'
  extra += '\n  Requires Bun; set PORT to change listen port (default 3000)'
}
```

- [ ] **Step 4: Docs**

README examples:

```bash
pnpm create avedon-app my-app --adapter=cloudflare
pnpm create avedon-app my-app --adapter=bun --yes
```

Note TTY prompts for adapter; `--yes` defaults to Node.

`docs/cli.md` / `docs/quick-start.md` flag table row:

| `--adapter=node\|cloudflare\|bun` | Production adapter (default `node`) |

`docs/deployment.md` after the opening paragraph:

> Scaffold with `pnpm create avedon-app my-app --adapter=cloudflare` (or `bun`) to wire the matching adapter at create time — see [CLI](./cli.md).

- [ ] **Step 5: Full package test**

```bash
pnpm -F create-avedon-app test
pnpm build --filter=create-avedon-app
```

Expected: PASS

- [ ] **Step 6: Smoke regression (local)**

```bash
# from repo root after build
node packages/cli/dist/cli.js create /tmp/avedon-adapter-smoke-node --yes
# assert avedon.config has adapter-node

node packages/cli/dist/cli.js create /tmp/avedon-adapter-smoke-cf --yes --adapter=cloudflare
# assert cloudflareAdapter + wrangler dep
```

(Or rely on existing `e2e/create-smoke.mjs` for `--yes` node path only.)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `--adapter=` + invalid error | Task 1 |
| TTY select, `--yes` → node | Task 1 |
| `applyAdapter` config/deps/scripts | Task 2 |
| Cloudflare `cd build && wrangler deploy` + wrangler dep | Task 2 |
| Bun `bun run build/server.js` | Task 2 |
| Monorepo `file:` for new adapters | Task 2 (link **after** apply) |
| `formatNextSteps` CF/Bun | Task 3 |
| README + cli/quick-start/deployment docs | Task 3 |
| create-smoke `--yes` unchanged | Task 3 (regression) |

## Self-review notes

- Spec listed “link then applyAdapter”; this plan **inverts** to apply then link so `file:` rewrites work — intentional fix, keep in implementer notes / update spec Status when landing.
- No TBD/placeholder steps remain.
- `avedon create` already passes full argv through `resolveCreateOptions` — no CLI package change required unless types break compile (re-export only).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-create-app-adapter.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
