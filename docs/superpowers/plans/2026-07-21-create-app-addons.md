# Create-app Add-ons (Tailwind + ORM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `create-avedon-app` / `avedon create` with optional Tailwind (style conversion) and ORM wiring (Drizzle / Prisma / none) via prompts and flags, keeping the default scaffold minimal.

**Architecture:** One base template; `scaffoldApp(dest, options)` applies pure filesystem transforms (`applyTailwind`, `applyOrm`). CLI layers call shared `resolveCreateOptions(argv)` (`@clack/prompts` on TTY, flags / `--yes` otherwise). Tailwind uses PostCSS (`@tailwindcss/postcss`) so the avedon Vite CLI needs no plugin merge.

**Tech Stack:** TypeScript, Vitest, `@clack/prompts`, Tailwind CSS v4 + `@tailwindcss/postcss`, drizzle-orm / drizzle-kit, prisma / `@prisma/client`.

## Global Constraints

- Defaults: `tailwind: false`, `orm: 'none'` (identical to today’s template when options omitted or `--yes`)
- ORM: deps + config stubs only — **no** models, schema tables, or migrations
- Tailwind toolchain: v4 via `@tailwindcss/postcss` + `postcss.config.js` (not `@tailwindcss/vite`)
- Do **not** change `examples/basic-app` styles for this feature
- Monorepo `file:` rewrite applies only to `avedon` / `@avedon/*`; ORM packages stay registry versions
- Drizzle/Prisma config stubs lock **PostgreSQL** dialect/provider
- Palette / brand tokens when converting Tailwind: `#09090B`, `#FAFAFA`, `#A1A1AA`, `#06B6D4`, `#0891B2`, Syne, lowercase `avedon`
- Commits: only when the user explicitly asks (repo preference) — skip commit steps unless asked
- Stay on `main` (no feature branches)

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/create-avedon-app/src/types.ts` | `OrmChoice`, `ScaffoldOptions`, `ScaffoldResult`, `CreateOptions` |
| `packages/create-avedon-app/src/options.ts` | Sync flag parse + async `resolveCreateOptions` (prompts) |
| `packages/create-avedon-app/src/options.test.ts` | Flag / resolve unit tests |
| `packages/create-avedon-app/src/apply-orm.ts` | Drizzle / Prisma deps + config + `.env.example` |
| `packages/create-avedon-app/src/apply-tailwind.ts` | PostCSS, `app.css`, client import, Tailwind `Home.ave` |
| `packages/create-avedon-app/src/index.ts` | `scaffoldApp` orchestration + `formatNextSteps` |
| `packages/create-avedon-app/src/scaffold.test.ts` | Default + tailwind + orm scaffold tests |
| `packages/create-avedon-app/src/cli.ts` | Bin entry: resolve options → scaffold |
| `packages/create-avedon-app/package.json` | Add `@clack/prompts` dependency |
| `packages/cli/src/cli.ts` | `avedon create` passes full argv through `resolveCreateOptions` |
| `packages/create-avedon-app/README.md` | Document flags / prompts |
| `e2e/create-smoke.mjs` | Pass `--yes` so TTY CI/dev does not hang on prompts |

---

### Task 1: Types + `scaffoldApp` options plumbing

**Files:**
- Create: `packages/create-avedon-app/src/types.ts`
- Modify: `packages/create-avedon-app/src/index.ts`
- Modify: `packages/create-avedon-app/src/scaffold.test.ts`
- Test: `packages/create-avedon-app/src/scaffold.test.ts`

**Interfaces:**
- Consumes: existing `scaffoldApp` / `formatNextSteps` / monorepo link helpers
- Produces:
  - `export type OrmChoice = 'none' | 'drizzle' | 'prisma'`
  - `export type ScaffoldOptions = { name?: string; tailwind?: boolean; orm?: OrmChoice }`
  - `export type ScaffoldResult = { dest: string; name: string; packageManager: ...; tailwind: boolean; orm: OrmChoice }`
  - `scaffoldApp(destInput: string, options?: ScaffoldOptions | string): ScaffoldResult` — if second arg is a **string**, treat as legacy `name` (backward compatible with current callers)

- [ ] **Step 1: Write the failing test** — add to `scaffold.test.ts`:

```ts
it('returns default addon flags when options omitted', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'defaults-app')
  const result = scaffoldApp(app)
  expect(result.tailwind).toBe(false)
  expect(result.orm).toBe('none')
  expect(result.name).toBe('defaults-app')
})

it('accepts legacy string name as second argument', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'legacy-name')
  const result = scaffoldApp(app, 'legacy-name')
  expect(result.name).toBe('legacy-name')
  expect(result.tailwind).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: FAIL — `result.tailwind` undefined / type mismatch

- [ ] **Step 3: Write minimal implementation**

Create `types.ts` with the types above.

In `index.ts`, normalize options:

```ts
import type { OrmChoice, ScaffoldOptions, ScaffoldResult } from './types.js'
export type { OrmChoice, ScaffoldOptions, ScaffoldResult } from './types.js'

function normalizeOptions(
  destInput: string,
  options?: ScaffoldOptions | string,
): Required<Pick<ScaffoldOptions, 'name' | 'tailwind' | 'orm'>> {
  if (typeof options === 'string') {
    return { name: options, tailwind: false, orm: 'none' }
  }
  return {
    name: options?.name ?? path.basename(path.resolve(destInput)),
    tailwind: options?.tailwind ?? false,
    orm: options?.orm ?? 'none',
  }
}

export function scaffoldApp(
  destInput: string,
  options?: ScaffoldOptions | string,
): ScaffoldResult {
  const opts = normalizeOptions(destInput, options)
  // ... existing copy + monorepo link ...
  // Task 1: do NOT call applyTailwind/applyOrm yet
  return {
    dest,
    name: opts.name,
    packageManager: detectPackageManager(),
    tailwind: opts.tailwind,
    orm: opts.orm,
  }
}
```

Update `formatNextSteps` to accept the wider `ScaffoldResult` (ignore new fields for now).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: PASS (existing + new)

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/src/types.ts packages/create-avedon-app/src/index.ts packages/create-avedon-app/src/scaffold.test.ts
git commit -m "feat(create-avedon-app): add scaffold options types and defaults"
```

---

### Task 2: Sync flag parser (`parseCreateArgs`)

**Files:**
- Create: `packages/create-avedon-app/src/options.ts`
- Create: `packages/create-avedon-app/src/options.test.ts`
- Modify: `packages/create-avedon-app/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `OrmChoice` from `types.ts`
- Produces:
  - `export type ParsedCreateArgs = { name?: string; yes: boolean; tailwind?: boolean; orm?: OrmChoice }`
  - `export function parseCreateArgs(argv: string[]): ParsedCreateArgs` — throws `Error` with message matching `/Invalid --orm/` on bad values
  - Does **not** prompt (sync only)

- [ ] **Step 1: Write the failing tests** in `options.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseCreateArgs } from './options.js'

describe('parseCreateArgs', () => {
  it('parses name and defaults', () => {
    expect(parseCreateArgs(['my-app'])).toEqual({
      name: 'my-app',
      yes: false,
      tailwind: undefined,
      orm: undefined,
    })
  })

  it('parses --yes and -y', () => {
    expect(parseCreateArgs(['--yes']).yes).toBe(true)
    expect(parseCreateArgs(['-y', 'x']).yes).toBe(true)
  })

  it('parses --tailwind and --no-tailwind', () => {
    expect(parseCreateArgs(['--tailwind']).tailwind).toBe(true)
    expect(parseCreateArgs(['--no-tailwind']).tailwind).toBe(false)
  })

  it('parses --orm=', () => {
    expect(parseCreateArgs(['--orm=drizzle']).orm).toBe('drizzle')
    expect(parseCreateArgs(['--orm=prisma']).orm).toBe('prisma')
    expect(parseCreateArgs(['--orm=none']).orm).toBe('none')
  })

  it('rejects invalid --orm', () => {
    expect(() => parseCreateArgs(['--orm=sqlite'])).toThrow(/Invalid --orm/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F create-avedon-app exec vitest run src/options.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** in `options.ts`:

```ts
import type { OrmChoice } from './types.js'

export type ParsedCreateArgs = {
  name?: string
  yes: boolean
  tailwind?: boolean
  orm?: OrmChoice
}

const ORMS = new Set<OrmChoice>(['none', 'drizzle', 'prisma'])

export function parseCreateArgs(argv: string[]): ParsedCreateArgs {
  let name: string | undefined
  let yes = false
  let tailwind: boolean | undefined
  let orm: OrmChoice | undefined

  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') {
      yes = true
      continue
    }
    if (arg === '--tailwind') {
      tailwind = true
      continue
    }
    if (arg === '--no-tailwind') {
      tailwind = false
      continue
    }
    if (arg.startsWith('--orm=')) {
      const value = arg.slice('--orm='.length) as OrmChoice
      if (!ORMS.has(value)) {
        throw new Error(`Invalid --orm=${value} (expected none|drizzle|prisma)`)
      }
      orm = value
      continue
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
    if (name !== undefined) {
      throw new Error(`Unexpected argument: ${arg}`)
    }
    name = arg
  }

  return { name, yes, tailwind, orm }
}
```

Re-export `parseCreateArgs` from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F create-avedon-app exec vitest run src/options.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/src/options.ts packages/create-avedon-app/src/options.test.ts packages/create-avedon-app/src/index.ts
git commit -m "feat(create-avedon-app): parse create CLI flags"
```

---

### Task 3: `applyOrm`

**Files:**
- Create: `packages/create-avedon-app/src/apply-orm.ts`
- Modify: `packages/create-avedon-app/src/index.ts` (call after monorepo link)
- Modify: `packages/create-avedon-app/src/scaffold.test.ts`

**Interfaces:**
- Consumes: `OrmChoice`
- Produces: `export function applyOrm(appDir: string, orm: OrmChoice): void` — no-op when `orm === 'none'`

- [ ] **Step 1: Write the failing tests** in `scaffold.test.ts`:

```ts
it('wires drizzle without schema models', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'drizzle-app')
  scaffoldApp(app, { name: 'drizzle-app', orm: 'drizzle' })

  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  expect(pkg.dependencies['drizzle-orm']).toBeTruthy()
  expect(pkg.devDependencies['drizzle-kit']).toBeTruthy()
  expect(pkg.scripts['db:generate']).toContain('drizzle-kit')
  expect(pkg.scripts['db:push']).toContain('drizzle-kit')

  const cfg = fs.readFileSync(path.join(app, 'drizzle.config.ts'), 'utf8')
  expect(cfg).toContain("dialect: 'postgresql'")
  expect(fs.existsSync(path.join(app, 'src/db/schema.ts'))).toBe(false)

  const envEx = fs.readFileSync(path.join(app, '.env.example'), 'utf8')
  expect(envEx).toMatch(/DATABASE_URL=/)
})

it('wires prisma without models', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'prisma-app')
  scaffoldApp(app, { name: 'prisma-app', orm: 'prisma' })

  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  expect(pkg.dependencies['@prisma/client']).toBeTruthy()
  expect(pkg.devDependencies.prisma).toBeTruthy()
  expect(pkg.scripts['db:generate']).toContain('prisma generate')

  const schema = fs.readFileSync(path.join(app, 'prisma/schema.prisma'), 'utf8')
  expect(schema).toContain('provider = "postgresql"')
  expect(schema).not.toMatch(/\bmodel\b/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: FAIL — missing drizzle files / deps

- [ ] **Step 3: Write minimal implementation**

`apply-orm.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'
import type { OrmChoice } from './types.js'

function readPkg(appDir: string) {
  const pkgPath = path.join(appDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  pkg.dependencies ??= {}
  pkg.devDependencies ??= {}
  pkg.scripts ??= {}
  return { pkgPath, pkg }
}

function ensureDatabaseUrlExample(appDir: string) {
  const envPath = path.join(appDir, '.env.example')
  const stub = 'DATABASE_URL=\n'
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, stub)
    return
  }
  const cur = fs.readFileSync(envPath, 'utf8')
  if (!cur.includes('DATABASE_URL=')) {
    fs.writeFileSync(envPath, cur.endsWith('\n') ? cur + stub : `${cur}\n${stub}`)
  }
}

export function applyOrm(appDir: string, orm: OrmChoice): void {
  if (orm === 'none') return
  ensureDatabaseUrlExample(appDir)
  const { pkgPath, pkg } = readPkg(appDir)

  if (orm === 'drizzle') {
    pkg.dependencies['drizzle-orm'] = '^0.44.2'
    pkg.devDependencies['drizzle-kit'] = '^0.31.4'
    pkg.scripts['db:generate'] = 'drizzle-kit generate'
    pkg.scripts['db:push'] = 'drizzle-kit push'
    fs.writeFileSync(
      path.join(appDir, 'drizzle.config.ts'),
      `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
`,
    )
  }

  if (orm === 'prisma') {
    pkg.dependencies['@prisma/client'] = '^6.11.1'
    pkg.devDependencies.prisma = '^6.11.1'
    pkg.scripts['db:generate'] = 'prisma generate'
    fs.mkdirSync(path.join(appDir, 'prisma'), { recursive: true })
    fs.writeFileSync(
      path.join(appDir, 'prisma/schema.prisma'),
      `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`,
    )
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
```

In `scaffoldApp`, after monorepo link:

```ts
if (opts.orm !== 'none') {
  applyOrm(dest, opts.orm)
}
```

Pin versions may be bumped to current stable at implement time — keep caret ranges.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/src/apply-orm.ts packages/create-avedon-app/src/index.ts packages/create-avedon-app/src/scaffold.test.ts
git commit -m "feat(create-avedon-app): wire optional Drizzle or Prisma stubs"
```

---

### Task 4: `applyTailwind`

**Files:**
- Create: `packages/create-avedon-app/src/apply-tailwind.ts`
- Modify: `packages/create-avedon-app/src/index.ts`
- Modify: `packages/create-avedon-app/src/scaffold.test.ts`

**Interfaces:**
- Consumes: none beyond `appDir: string`
- Produces: `export function applyTailwind(appDir: string): void`

- [ ] **Step 1: Write the failing test**:

```ts
it('converts starter styles when tailwind is enabled', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'tw-app')
  scaffoldApp(app, { name: 'tw-app', tailwind: true })

  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  expect(pkg.devDependencies.tailwindcss).toBeTruthy()
  expect(pkg.devDependencies['@tailwindcss/postcss']).toBeTruthy()
  expect(pkg.devDependencies.postcss).toBeTruthy()

  expect(fs.existsSync(path.join(app, 'postcss.config.js'))).toBe(true)
  const css = fs.readFileSync(path.join(app, 'src/app.css'), 'utf8')
  expect(css).toContain('@import "tailwindcss"')
  expect(css).toContain('#09090B')

  const client = fs.readFileSync(path.join(app, 'src/client.ts'), 'utf8')
  expect(client).toContain("./app.css")

  const home = fs.readFileSync(path.join(app, 'src/pages/Home.ave'), 'utf8')
  expect(home).not.toContain('<style unscoped>')
  expect(home.toLowerCase()).toContain('avedon')
  expect(home).toContain('signal')
})
```

Also assert default scaffold still has `<style unscoped>` (existing or new assertion on the defaults test).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: FAIL — missing postcss / app.css

- [ ] **Step 3: Write minimal implementation**

`apply-tailwind.ts` must:

1. Add to `package.json` `devDependencies`:
   - `tailwindcss: '^4.1.11'`
   - `@tailwindcss/postcss: '^4.1.11'`
   - `postcss: '^8.5.6'`
   (bump to current stable caret at implement time)

2. Write `postcss.config.js`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

3. Write `src/app.css` with:
   - `@import "tailwindcss";`
   - `@theme` tokens for bg/fg/muted/accent/accent-deep/font-sans (Syne)
   - base `html, body` using theme tokens
   - custom classes kept for atmosphere/motion: `.stage-glow`, `.stage-grid`, `@keyframes rise`, `@keyframes drift`, `prefers-reduced-motion` rules (ported from current `Home.ave` `<style>`)

4. Prepend to `src/client.ts`:

```ts
import './app.css'
```

(keep existing `import 'virtual:avedon-client-entry'`)

5. Overwrite `src/pages/Home.ave` — scripts + template only; **no** `<style>` block. Map structure to utilities, keep `.stage-glow` / `.stage-grid` / `.brand` rise animation class names that `app.css` defines. Example template skeleton (expand utilities to match visual parity):

```ave
<script lang="ts">
  import { signal } from '@avedon/runtime'

  export let title

  const count = signal(0)

  function inc() {
    count.set(count.get() + 1)
  }

  function reset() {
    count.set(0)
  }
</script>

<script lang="ts" server>
  export async function load() {
    return { title: 'avedon' }
  }
</script>

<template>
  <main class="relative isolate mx-auto flex min-h-screen w-[min(100%,56rem)] flex-col justify-center gap-7 overflow-visible p-[clamp(1.5rem,4vw,3rem)]">
    <div class="stage-glow" aria-hidden="true"></div>
    <div class="stage-grid" aria-hidden="true"></div>
    <p class="brand m-0 pr-[0.06em] text-[clamp(3.5rem,12vw,7rem)] font-extrabold leading-none tracking-[-0.04em]">{title}</p>
    <h1 class="headline m-0 max-w-[18ch] text-[clamp(1.35rem,3.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.03em]">
      Full-stack TypeScript, one .ave file.
    </h1>
    <p class="support m-0 max-w-xl text-[1.05rem] font-normal leading-normal text-muted">
      Edit src/pages/Home.ave and save — the dev server reloads with your changes.
    </p>
    <section class="demo mt-1 max-w-xs rounded-[0.4rem] border border-line px-5 py-[1.1rem]">
      <p class="mb-3 text-[0.85rem] font-medium text-muted">Live signal — this runs in the browser.</p>
      <div class="flex items-baseline justify-between gap-4">
        <span class="text-[2.5rem] font-extrabold tracking-[-0.04em] text-accent tabular-nums">{count}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
            on:click={inc}
          >
            Increment
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
            on:click={reset}
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
```

Define `--color-muted`, `--color-accent`, `--color-fg`, `--color-line` (or equivalent `@theme` keys) so `text-muted` / `border-line` resolve. Keep `.brand`, `.headline`, `.support`, `.demo` animation hooks in `app.css`.

Wire in `scaffoldApp`:

```ts
if (opts.tailwind) {
  applyTailwind(dest)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/src/apply-tailwind.ts packages/create-avedon-app/src/index.ts packages/create-avedon-app/src/scaffold.test.ts
git commit -m "feat(create-avedon-app): optional Tailwind transform for starter home"
```

---

### Task 5: `formatNextSteps` for add-ons

**Files:**
- Modify: `packages/create-avedon-app/src/index.ts`
- Modify: `packages/create-avedon-app/src/scaffold.test.ts` (or small dedicated assert)

**Interfaces:**
- Consumes: `ScaffoldResult` with `tailwind` + `orm`
- Produces: updated `formatNextSteps(result: ScaffoldResult): string`

- [ ] **Step 1: Write the failing test**:

```ts
it('mentions ORM env next steps when orm is set', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-scaffold-'))
  dirs.push(dest)
  const app = path.join(dest, 'steps-app')
  const result = scaffoldApp(app, { name: 'steps-app', orm: 'drizzle' })
  const steps = formatNextSteps(result)
  expect(steps).toMatch(/DATABASE_URL|\.env/)
  expect(steps.toLowerCase()).toMatch(/drizzle/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts -t "mentions ORM"`
Expected: FAIL

- [ ] **Step 3: Extend `formatNextSteps`**

After the install / `avedon dev` lines, when `result.orm !== 'none'`:

```
  Copy .env.example → .env and set DATABASE_URL
  (drizzle) then use db:generate / db:push when you add a schema
  (prisma) then run db:generate after you add models
```

When `result.tailwind`, optional one-liner: `Tailwind is ready — edit classes in src/pages/Home.ave`.

- [ ] **Step 4: Run tests**

Run: `pnpm -F create-avedon-app exec vitest run src/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/src/index.ts packages/create-avedon-app/src/scaffold.test.ts
git commit -m "feat(create-avedon-app): print add-on next steps after scaffold"
```

---

### Task 6: Interactive `resolveCreateOptions` + wire both CLIs

**Files:**
- Modify: `packages/create-avedon-app/src/options.ts`
- Modify: `packages/create-avedon-app/src/options.test.ts`
- Modify: `packages/create-avedon-app/src/cli.ts`
- Modify: `packages/create-avedon-app/package.json` (add `@clack/prompts`)
- Modify: `packages/cli/src/cli.ts`
- Modify: `e2e/create-smoke.mjs` (add `--yes`)

**Interfaces:**
- Consumes: `parseCreateArgs`
- Produces:
  - `export type CreateOptions = { name: string; tailwind: boolean; orm: OrmChoice }`
  - `export async function resolveCreateOptions(argv: string[], opts?: { stdinIsTTY?: boolean }): Promise<CreateOptions>`
  - Behavior:
    - Always `parseCreateArgs` first
    - If `yes` **or** `stdinIsTTY === false` (default: `process.stdin.isTTY`): no prompts; `name` defaults to `'my-avedon-app'`; `tailwind` defaults false unless flag; `orm` defaults `'none'` unless flag
    - If TTY and not `--yes`: prompt name (if missing), confirm Tailwind (default no), select ORM (default none)
    - On `@clack/prompts` cancel (`isCancel`): `process.exit(0)`
  - Re-export from `index.ts`

- [ ] **Step 1: Add dependency**

Run: `pnpm -F create-avedon-app add @clack/prompts`

- [ ] **Step 2: Write failing tests** for non-interactive resolve:

```ts
import { resolveCreateOptions } from './options.js'

describe('resolveCreateOptions', () => {
  it('uses defaults with --yes', async () => {
    const opts = await resolveCreateOptions(['--yes'], { stdinIsTTY: true })
    expect(opts).toEqual({ name: 'my-avedon-app', tailwind: false, orm: 'none' })
  })

  it('honors flags without prompting even on TTY', async () => {
    const opts = await resolveCreateOptions(
      ['shop', '--tailwind', '--orm=prisma'],
      { stdinIsTTY: true },
    )
    expect(opts).toEqual({ name: 'shop', tailwind: true, orm: 'prisma' })
  })

  it('skips prompts when not a TTY', async () => {
    const opts = await resolveCreateOptions([], { stdinIsTTY: false })
    expect(opts).toEqual({ name: 'my-avedon-app', tailwind: false, orm: 'none' })
  })
})
```

Note: when flags fully specify name+tailwind+orm, skip prompts even without `--yes`. When TTY and name missing and not `--yes`, prompts run — do not unit-test the interactive path (manual / smoke). Implement prompt branch but keep tests on non-interactive paths.

- [ ] **Step 3: Run tests — expect FAIL**

Run: `pnpm -F create-avedon-app exec vitest run src/options.test.ts`
Expected: FAIL — `resolveCreateOptions` missing

- [ ] **Step 4: Implement `resolveCreateOptions`**

```ts
import * as p from '@clack/prompts'
import type { OrmChoice } from './types.js'
import { parseCreateArgs } from './options.js' // same file — structure as single module

export type CreateOptions = {
  name: string
  tailwind: boolean
  orm: OrmChoice
}

export async function resolveCreateOptions(
  argv: string[],
  opts?: { stdinIsTTY?: boolean },
): Promise<CreateOptions> {
  const parsed = parseCreateArgs(argv)
  const tty = opts?.stdinIsTTY ?? Boolean(process.stdin.isTTY)
  const forceDefaults = parsed.yes || !tty

  if (forceDefaults) {
    return {
      name: parsed.name ?? 'my-avedon-app',
      tailwind: parsed.tailwind ?? false,
      orm: parsed.orm ?? 'none',
    }
  }

  // Prompt only for fields not set by flags
  let name = parsed.name
  if (!name) {
    const answered = await p.text({
      message: 'Project name',
      placeholder: 'my-avedon-app',
      defaultValue: 'my-avedon-app',
    })
    if (p.isCancel(answered)) process.exit(0)
    name = String(answered).trim() || 'my-avedon-app'
  }

  let tailwind = parsed.tailwind
  if (tailwind === undefined) {
    const answered = await p.confirm({
      message: 'Add Tailwind CSS?',
      initialValue: false,
    })
    if (p.isCancel(answered)) process.exit(0)
    tailwind = Boolean(answered)
  }

  let orm = parsed.orm
  if (orm === undefined) {
    const answered = await p.select({
      message: 'Add an ORM?',
      options: [
        { value: 'none', label: 'None' },
        { value: 'drizzle', label: 'Drizzle' },
        { value: 'prisma', label: 'Prisma' },
      ],
      initialValue: 'none',
    })
    if (p.isCancel(answered)) process.exit(0)
    orm = answered as OrmChoice
  }

  return { name, tailwind, orm }
}
```

Rules: `--yes` or non-TTY → skip prompts, merge explicit flags with defaults. Otherwise prompt only for fields not already set by flags. Providing just a name still asks Tailwind/ORM.

- [ ] **Step 5: Wire `create-avedon-app` CLI**

Replace `packages/create-avedon-app/src/cli.ts` with:

```ts
import path from 'node:path'
import { formatNextSteps, resolveCreateOptions, scaffoldApp } from './index.js'

async function main() {
  try {
    const options = await resolveCreateOptions(process.argv.slice(2))
    const dest = path.resolve(options.name)
    const result = scaffoldApp(dest, options)
    console.log(formatNextSteps(result))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
```

- [ ] **Step 6: Wire `avedon create`**

In `packages/cli/src/cli.ts`:

- Import `resolveCreateOptions` from `create-avedon-app`
- Change `case 'create':` to `await cmdCreate(args)` (full argv after `create`)
- Update `cmdCreate`:

```ts
async function cmdCreate(argv: string[]) {
  try {
    const options = await resolveCreateOptions(argv)
    const dest = path.resolve(options.name)
    const result = scaffoldApp(dest, options)
    console.log(formatNextSteps(result))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
```

- Update `printHelp` usage line:

```
  avedon create [name] [--yes] [--tailwind|--no-tailwind] [--orm=none|drizzle|prisma]
```

- [ ] **Step 7: Fix e2e create-smoke hang**

In `e2e/create-smoke.mjs`, change create invocation to:

```js
await run(process.execPath, [cli, 'create', appDir, '--yes'], {
  cwd: root,
  env: { ...process.env, AVEDON_MONOREPO_ROOT: root },
})
```

(`appDir` is absolute — `parseCreateArgs` treats it as `name`; `path.resolve(options.name)` stays absolute. OK.)

- [ ] **Step 8: Run unit tests + rebuild**

Run:

```bash
pnpm -F create-avedon-app build
pnpm -F avedon build
pnpm -F create-avedon-app exec vitest run src/options.test.ts src/scaffold.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit** (only if user asked)

```bash
git add packages/create-avedon-app packages/cli/src/cli.ts e2e/create-smoke.mjs pnpm-lock.yaml
git commit -m "feat(create): interactive prompts and flags for Tailwind/ORM add-ons"
```

---

### Task 7: Docs + memories status

**Files:**
- Modify: `packages/create-avedon-app/README.md`
- Modify: `docs/superpowers/specs/2026-07-21-create-app-addons-design.md` (Status → Implemented)
- Modify: `memories.md` (mark plan implemented)

- [ ] **Step 1: Update README** with examples:

```bash
pnpm create avedon-app my-app
pnpm create avedon-app my-app --yes
pnpm create avedon-app my-app --tailwind --orm=drizzle
avedon create my-app --no-tailwind --orm=none
```

Brief note: prompts on TTY; Tailwind converts starter CSS; ORM adds config stubs only.

- [ ] **Step 2: Mark design status Implemented; update memories Status bullet** for create-app add-ons from “plan pending” to “implemented”.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add packages/create-avedon-app/README.md docs/superpowers/specs/2026-07-21-create-app-addons-design.md memories.md
git commit -m "docs: mark create-app add-ons as implemented"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Light add-ons, single template + transforms | 1, 3, 4 |
| Tailwind convert styles; PostCSS v4 | 4 |
| ORM drizzle/prisma/none, no schema models | 3 |
| Interactive + flags + `--yes` defaults | 2, 6 |
| Shared resolve for both CLIs | 6 |
| `.env.example` DATABASE_URL | 3 |
| formatNextSteps mentions | 5 |
| Unit tests for scaffold + flags | 1–5 |
| create-smoke won’t hang on prompts | 6 (`--yes`) |
| No basic-app style changes | Global constraint |
| No Vite plugin merge | Global constraint |

Placeholder scan: none intentional.  
Type names consistent: `OrmChoice`, `ScaffoldOptions`, `ScaffoldResult`, `CreateOptions`, `parseCreateArgs`, `resolveCreateOptions`, `applyOrm`, `applyTailwind`.
