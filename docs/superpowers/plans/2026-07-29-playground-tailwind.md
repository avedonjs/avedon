# Playground Tailwind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@tailwindcss/browser` as a local playground iframe asset and restyle all www playground presets with create-app-aligned Tailwind utilities.

**Architecture:** Prebuild copies `@tailwindcss/browser` → `public/playground-tailwind.js`. The iframe loads that script plus a `type="text/tailwindcss"` theme block (same `@theme` tokens as create-app). Presets become utility-first; www docs chrome stays without Tailwind.

**Tech Stack:** `@tailwindcss/browser@^4.1.11`, existing `build-playground-runtime.mjs` predev/prebuild chain, `apps/www/src/playground/{runner,presets}.ts`

## Global Constraints

- Delivery: `@tailwindcss/browser` only (no CDN, no PostCSS on www shell)
- Theme tokens must match create-app: `--color-bg #09090B`, `--color-fg #FAFAFA`, `--color-muted #A1A1AA`, `--color-accent #06B6D4`, `--color-accent-deep #0891B2`, `--color-line rgba(250,250,250,0.12)`
- Do not add Tailwind to Layout/Home/docs pages
- Keep e2e selectors/behavior intact (`Increment`, `Count: N`, `class:primary`, placeholders, mock load/action text)
- Commit only when the user explicitly asks (user rule overrides frequent-commit plan defaults)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/www/package.json` | Add `@tailwindcss/browser` devDependency |
| `apps/www/scripts/build-playground-runtime.mjs` | Also emit `public/playground-tailwind.js` |
| `.gitignore` | Ignore `apps/www/public/playground-tailwind.js` |
| `apps/www/src/playground/runner.ts` | Inject theme style + Tailwind script into iframe |
| `apps/www/src/playground/presets.ts` | Utility-first sources for all presets |
| `memories.md` | Short status note when done |

---

### Task 1: Install package + emit local Tailwind asset

**Files:**
- Modify: `apps/www/package.json`
- Modify: `apps/www/scripts/build-playground-runtime.mjs`
- Modify: `.gitignore`
- Generate: `apps/www/public/playground-tailwind.js` (gitignored)

**Interfaces:**
- Consumes: `node_modules/@tailwindcss/browser/dist/index.global.js`
- Produces: `public/playground-tailwind.js` served at `/playground-tailwind.js`

- [ ] **Step 1: Add the dependency**

Run from repo root:

```bash
pnpm add -D @tailwindcss/browser@4.1.11 --filter www
```

Expected: `apps/www/package.json` lists `"@tailwindcss/browser": "4.1.11"` (or compatible `^4.1.11`) under `devDependencies`; lockfile updates.

- [ ] **Step 2: Extend the prebuild script**

Replace `apps/www/scripts/build-playground-runtime.mjs` with:

```js
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const wwwRoot = path.join(root, '..')
const publicDir = path.join(wwwRoot, 'public')
const require = createRequire(import.meta.url)

await esbuild.build({
  entryPoints: [path.join(wwwRoot, 'src/playground/runtime-shim.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(publicDir, 'playground-runtime.js'),
  logLevel: 'info',
})

const twEntry = require.resolve('@tailwindcss/browser')
const twOut = path.join(publicDir, 'playground-tailwind.js')
fs.copyFileSync(twEntry, twOut)
console.log(`copied ${path.relative(wwwRoot, twEntry)} → public/playground-tailwind.js`)
```

- [ ] **Step 3: Gitignore the generated asset**

In `.gitignore`, next to the existing `apps/www/public/playground-runtime.js` line, add:

```
apps/www/public/playground-tailwind.js
```

- [ ] **Step 4: Verify the build emits both assets**

Run:

```bash
node apps/www/scripts/build-playground-runtime.mjs
ls -la apps/www/public/playground-runtime.js apps/www/public/playground-tailwind.js
```

Expected: both files exist; `playground-tailwind.js` is non-empty (hundreds of KB).

- [ ] **Step 5: Do not commit yet** (wait for user request)

---

### Task 2: Wire Tailwind + theme into the playground iframe

**Files:**
- Modify: `apps/www/src/playground/runner.ts` (`buildIframeHtml`)

**Interfaces:**
- Consumes: `/playground-tailwind.js` from Task 1
- Produces: iframe HTML that enables utilities + `text-accent` / `border-line` / etc.

- [ ] **Step 1: Update `buildIframeHtml` head**

In `apps/www/src/playground/runner.ts`, change the head section inside `buildIframeHtml` so it looks like this (keep the rest of the function unchanged):

```ts
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #09090b;
    color: #fafafa;
    font-family: system-ui, sans-serif;
    padding: 1rem;
    box-sizing: border-box;
  }
  * { box-sizing: border-box; }
</style>
<style type="text/tailwindcss">
  @theme {
    --color-bg: #09090B;
    --color-fg: #FAFAFA;
    --color-muted: #A1A1AA;
    --color-accent: #06B6D4;
    --color-accent-deep: #0891B2;
    --color-line: rgba(250, 250, 250, 0.12);
  }
  .primary {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
<script src="/playground-tailwind.js"></script>
<style id="pg-css">${css}</style>
<script type="importmap">
${JSON.stringify({ imports: { '@avedon/runtime': opts.runtimeUrl } }, null, 2)}
</script>
</head>
<body>
<div id="app"></div>
<script type="module">
```

Notes:
- `type="text/tailwindcss"` is required for `@tailwindcss/browser` to process `@theme`.
- Keep `.primary` in the theme block so the `class:` preset + e2e (`toHaveClass(/primary/)`) stay valid without a per-preset `<style>`.

- [ ] **Step 2: Smoke-check in running dev server**

With `pnpm -F www dev` running (restart if predev already completed before Task 1):

1. Open `/playground?e=counter`
2. In the preview iframe, temporarily ensure Increment button will get utilities in Task 3; for now verify Network shows `200` for `/playground-tailwind.js`
3. In browser console of the iframe (or parent), no script load errors for that URL

Expected: `/playground-tailwind.js` loads successfully.

- [ ] **Step 3: Do not commit yet**

---

### Task 3: Restyle all playground presets with Tailwind

**Files:**
- Modify: `apps/www/src/playground/presets.ts` (entire `source` strings)

**Interfaces:**
- Consumes: iframe theme tokens from Task 2 (`text-accent`, `text-muted`, `border-line`, `.primary`)
- Produces: utility-styled presets; behavior and visible strings unchanged for e2e

Shared button utility string (reuse in presets):

```
cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent
```

Shared input utility string:

```
rounded-[0.3rem] border border-line bg-transparent px-3 py-2 text-fg outline-none focus:border-accent
```

- [ ] **Step 1: Replace each preset `source` as follows**

**counter**

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const count = signal(0)
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 text-muted">Count: <span class="font-semibold text-fg tabular-nums">{count}</span></p>
    <button
      type="button"
      class="w-fit cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      on:click={() => count = count + 1}
    >Increment</button>
  </div>
</template>
```

**todo**

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'

  type Todo = { id: number; text: string }
  const items = signal<Todo[]>([
    { id: 1, text: 'Learn signals' },
    { id: 2, text: 'Try the playground' },
  ])
  const draft = signal('')
  let nextId = 3

  function add() {
    const text = draft.trim()
    if (!text) return
    items = [...items, { id: nextId++, text }]
    draft = ''
  }
</script>

<template>
  <div class="flex flex-col gap-4">
    <form class="flex flex-wrap gap-2" on:submit|preventDefault={add}>
      <input
        class="min-w-[12rem] flex-1 rounded-[0.3rem] border border-line bg-transparent px-3 py-2 text-fg outline-none focus:border-accent"
        bind:value={draft}
        placeholder="New todo"
      />
      <button
        type="submit"
        class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      >Add</button>
    </form>
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      {#each items as item (item.id)}
        <li class="rounded-[0.3rem] border border-line px-3 py-2 text-fg">{item.text}</li>
      {/each}
    </ul>
  </div>
</template>
```

**conditional** — remove `<style scoped>`; use utilities:

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const on = signal(true)
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      class="w-fit cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      on:click={() => on = !on}
    >Toggle</button>
    {#if on}
      <p class="m-0 text-accent">Lights on</p>
    {:else}
      <p class="m-0 text-muted">Lights off</p>
    {/if}
  </div>
</template>
```

**bind-value**

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const name = signal('avedon')
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1 text-sm text-muted">
      Name
      <input
        class="rounded-[0.3rem] border border-line bg-transparent px-3 py-2 text-fg outline-none focus:border-accent"
        bind:value={name}
      />
    </label>
    <p class="m-0 text-fg">Hello, {name}!</p>
  </div>
</template>
```

**checkbox-group**

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const picks = signal<string[]>(['docs'])

  function label() {
    return picks.join(', ') || '(none)'
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="docs" /> Docs</label>
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="playground" /> Playground</label>
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="github" /> GitHub</label>
    <p class="m-0 text-muted">Selected: <span class="text-fg">{label()}</span></p>
  </div>
</template>
```

**batch**

```html
<script lang="ts">
  import { batch, signal } from '@avedon/runtime'
  const a = signal(0)
  const b = signal(0)
  const runs = signal(0)

  function bump() {
    batch(() => {
      a = a + 1
      b = b + 1
      runs = runs + 1
    })
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 font-mono text-sm text-muted">a={a} b={b} runs={runs}</p>
    <button
      type="button"
      class="w-fit cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      on:click={bump}
    >Batch bump</button>
  </div>
</template>
```

**class-directive** — keep `class:primary={active}`; drop scoped style (`.primary` lives in iframe theme):

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const active = signal(false)
</script>

<template>
  <button
    type="button"
    class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150"
    class:primary={active}
    on:click={() => active = !active}
  >
    {active ? 'Active' : 'Inactive'}
  </button>
</template>
```

**transition-fade**

```html
<script lang="ts">
  import { signal } from '@avedon/runtime'
  const show = signal(true)
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      class="w-fit cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      on:click={() => show = !show}
    >Toggle</button>
    {#if show}
      <p class="m-0 text-accent" transition:fade>Fading content</p>
    {/if}
  </div>
</template>
```

**use-slugify** / **snake-case** (same layout; only `use:` import differs)

slugify:

```html
<script lang="ts">
  import { signal, slugify } from '@avedon/runtime'
  const out = signal('')
  function onInput(e: Event) {
    out = (e.target as HTMLInputElement).value
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <input
      type="text"
      class="rounded-[0.3rem] border border-line bg-transparent px-3 py-2 text-fg outline-none focus:border-accent"
      use:slugify
      placeholder="Hello World"
      on:input={onInput}
    />
    <p class="m-0 text-muted">{out}</p>
  </div>
</template>
```

snakeCase: same template; `import { signal, snakeCase }` and `use:snakeCase`.

**await-then** — prefer Tailwind spinner; no scoped style:

```html
<script lang="ts">
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const promise = delay(1800).then(() => 'Configuration loaded')
</script>

<template>
  {#await promise}
    <div class="flex flex-col items-center gap-3 py-4" role="status" aria-label="Loading">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      ></div>
      <p class="m-0 text-sm text-muted">Fetching data…</p>
    </div>
  {:then value}
    <p class="m-0 text-accent">{value}</p>
  {/await}
</template>
```

**load-data**

```html
<script lang="ts">
  export let data
</script>

<script server>
  export async function load() {
    return {
      data: {
        message: 'Hello from mock load()',
        items: ['Signals', 'Routes', 'Actions'],
      },
    }
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <h2 class="m-0 text-xl font-bold tracking-tight text-fg">{data.message}</h2>
    <ul class="m-0 flex list-disc flex-col gap-1 pl-5 text-muted">
      {#each data.items as item}
        <li class="text-fg">{item}</li>
      {/each}
    </ul>
  </div>
</template>
```

**form-action**

```html
<script lang="ts">
  export let data
</script>

<script server>
  let count = 0

  export async function load() {
    return { data: { count } }
  }

  export const actions = {
    async increment() {
      count += 1
      return { data: { count } }
    },
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 text-muted">Count: <span class="font-semibold text-fg tabular-nums">{data.count}</span></p>
    <form method="POST" action="?_action=increment">
      <button
        type="submit"
        class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
      >Increment (action)</button>
    </form>
  </div>
</template>
```

- [ ] **Step 2: Manual visual check**

Restart or ensure prebuild ran, open `/playground`, flip through presets. Confirm:
- Buttons/inputs look styled (not bare UA)
- Conditional on/off colors use accent/muted
- Await shows spinning border then accent text
- `class:` still toggles cyan border via `.primary`

- [ ] **Step 3: Do not commit yet**

---

### Task 4: Verify e2e + update memories

**Files:**
- Modify: `memories.md` (Status section only)
- Test: `e2e/www.spec.ts` (run, do not change unless a string regression is intentional)

- [ ] **Step 1: Run www Playwright tests**

```bash
pnpm exec playwright test -c playwright.www.config.ts
```

(or the repo’s documented www e2e command if different — check `package.json` / `playwright.www.config.ts`).

Expected: all playground tests PASS (`counter`, `load-data`, `form-action`, `bind-value`, `checkbox-group`, `todo`, `class-directive`).

- [ ] **Step 2: Update `memories.md` Status**

Add/replace a short bullet under Status:

```markdown
- **www playground Tailwind (2026-07-29):** iframe loads local `/playground-tailwind.js` (`@tailwindcss/browser`); create-app `@theme` tokens; all presets utility-styled. Spec/plan under `docs/superpowers/{specs,plans}/2026-07-29-playground-tailwind*`. **Uncommitted.**
```

- [ ] **Step 3: Offer commit to the user** (do not commit unless asked)

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| `@tailwindcss/browser` local asset | Task 1 |
| Theme tokens match create-app | Task 2 |
| Presets utility-first | Task 3 |
| www shell unchanged | (no task touches Layout/docs CSS) |
| No CDN | Task 1–2 |
| e2e stay green | Task 4 |
| Spinner without heavy scoped CSS | Task 3 await-then |

## Placeholder / consistency check

- Asset path: always `/playground-tailwind.js` / `public/playground-tailwind.js`
- Dependency version floor: `4.1.11` aligned with create-app
- `.primary` defined once in iframe theme for `class:` e2e
