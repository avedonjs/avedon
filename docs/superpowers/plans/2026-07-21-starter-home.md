# Starter Home Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dark-stage starter home (brand + headline + CTAs + live `signal` demo) in both `create-avedon-app` template and `examples/basic-app`.

**Architecture:** Parallel `.ave` + `app.html` updates (no shared CSS package). Template is a single polished `/` page; basic-app keeps lab routes behind a quiet nav and inherits dark body styles from `Layout.ave`.

**Tech Stack:** `.ave` components, `@avedon/runtime` `signal`, scoped CSS, Google Fonts (Syne), existing Vite/avedon toolchain — no new npm deps.

## Global Constraints

- Palette tokens exactly: `--bg #09090B`, `--fg #FAFAFA`, `--muted #A1A1AA`, `--accent #06B6D4`, `--accent-deep #0891B2`, `--line rgba(250,250,250,0.12)`
- Wordmark: lowercase `avedon` only
- Display font: **Syne** (not Inter / Roboto / Arial / system-ui as primary)
- No Tailwind / CSS frameworks / new package.json dependencies
- No feature grids, floating badges, or pill clusters in the hero
- `prefers-reduced-motion: reduce` disables entrance animation
- Commits: only when the user explicitly asks (repo preference)

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/create-avedon-app/template/src/app.html` | Fonts, `color-scheme: dark`, theme-color |
| `packages/create-avedon-app/template/src/pages/Home.ave` | Full starter composition + signal demo |
| `examples/basic-app/src/app.html` | Same font / color-scheme hooks |
| `examples/basic-app/src/pages/Layout.ave` | Dark shell + quiet lab nav |
| `examples/basic-app/src/pages/Home.ave` | Same composition; demo login secondary |
| `docs/superpowers/specs/2026-07-21-starter-home-design.md` | Already approved; mark Implemented when done |

---

### Task 1: Template `app.html` dark + Syne

**Files:**
- Modify: `packages/create-avedon-app/template/src/app.html`

**Interfaces:**
- Consumes: none
- Produces: document with Syne loaded and `color-scheme: dark` for Home styles

- [ ] **Step 1: Replace template `app.html` with:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#09090B" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&display=swap"
      rel="stylesheet"
    />
    %avedon.head%
  </head>
  <body>
    <div id="app">%avedon.body%</div>
  </body>
</html>
```

- [ ] **Step 2: Sanity-check file exists and has no Turkish / Georgia leftovers**

Run: `rg -n "Georgia|Inter|color-scheme" packages/create-avedon-app/template/src/app.html`
Expected: only `color-scheme` match (dark), no Georgia/Inter

---

### Task 2: Template `Home.ave` starter UI + signal demo

**Files:**
- Modify: `packages/create-avedon-app/template/src/pages/Home.ave`

**Interfaces:**
- Consumes: `signal` from `@avedon/runtime`; fonts from Task 1
- Produces: SSR `title` prop optional; client counter via `signal`

- [ ] **Step 1: Replace `Home.ave` with the following (complete file):**

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

<style scoped>
  :global(:root) {
    --bg: #09090b;
    --fg: #fafafa;
    --muted: #a1a1aa;
    --accent: #06b6d4;
    --accent-deep: #0891b2;
    --line: rgba(250, 250, 250, 0.12);
    --font: 'Syne', sans-serif;
  }

  :global(html),
  :global(body) {
    margin: 0;
    min-height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font);
  }

  .stage {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    box-sizing: border-box;
    padding: clamp(1.5rem, 4vw, 3rem);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.75rem;
    max-width: 56rem;
    margin: 0 auto;
    overflow: hidden;
  }

  .stage::before {
    content: '';
    position: absolute;
    inset: -20% -10% auto auto;
    width: min(70vw, 36rem);
    height: min(70vw, 36rem);
    background: radial-gradient(circle, rgba(6, 182, 212, 0.14), transparent 68%);
    pointer-events: none;
    z-index: -1;
  }

  .stage::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(250, 250, 250, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(250, 250, 250, 0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 30% 20%, #000 20%, transparent 70%);
    pointer-events: none;
    z-index: -1;
  }

  .brand {
    margin: 0;
    font-size: clamp(3.5rem, 12vw, 7rem);
    font-weight: 800;
    letter-spacing: -0.06em;
    line-height: 0.95;
    animation: rise 0.7s ease both;
  }

  .headline {
    margin: 0;
    max-width: 18ch;
    font-size: clamp(1.35rem, 3.5vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
    animation: rise 0.7s ease 0.06s both;
  }

  .support {
    margin: 0;
    max-width: 36rem;
    color: var(--muted);
    font-size: 1.05rem;
    font-weight: 400;
    line-height: 1.5;
    animation: rise 0.7s ease 0.12s both;
  }

  .ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1.25rem;
    align-items: center;
    animation: rise 0.7s ease 0.18s both;
  }

  .cta-primary {
    display: inline-flex;
    align-items: center;
    padding: 0.7rem 1.15rem;
    background: var(--accent);
    color: #042f2e;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    border: 0;
    border-radius: 0.35rem;
    transition: background 0.15s ease;
  }

  .cta-primary:hover {
    background: var(--accent-deep);
    color: #fff;
  }

  .cta-secondary {
    color: var(--fg);
    font-weight: 500;
    text-decoration: none;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.1rem;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .cta-secondary:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .demo {
    margin-top: 0.5rem;
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: 0.4rem;
    max-width: 22rem;
    animation: rise 0.7s ease 0.24s both;
  }

  .demo-label {
    margin: 0 0 0.75rem;
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .demo-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .demo-count {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .demo-actions {
    display: flex;
    gap: 0.5rem;
  }

  .demo-actions button {
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0.45rem 0.75rem;
    border-radius: 0.3rem;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--fg);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .demo-actions button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.6rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand,
    .headline,
    .support,
    .ctas,
    .demo {
      animation: none;
    }
  }
</style>

<template>
  <main class="stage">
    <p class="brand">{title}</p>
    <h1 class="headline">Full-stack TypeScript, one .ave file.</h1>
    <p class="support">Edit src/pages/Home.ave and save — the dev server reloads with your changes.</p>
    <div class="ctas">
      <a class="cta-primary" href="#demo">Try the live signal</a>
      <a class="cta-secondary" href="https://github.com/avedonjs/avedon" target="_blank" rel="noreferrer">GitHub</a>
    </div>
    <section class="demo" id="demo">
      <p class="demo-label">Live signal — this runs in the browser.</p>
      <div class="demo-row">
        <span class="demo-count">{count}</span>
        <div class="demo-actions">
          <button type="button" on:click={inc}>Increment</button>
          <button type="button" on:click={reset}>Reset</button>
        </div>
      </div>
    </section>
  </main>
</template>
```

- [ ] **Step 2: Verify template still typechecks / compiles in isolation**

Run: `pnpm -F create-avedon-app test`
Expected: PASS (scaffold tests)

---

### Task 3: Example `app.html` + dark `Layout.ave`

**Files:**
- Modify: `examples/basic-app/src/app.html`
- Modify: `examples/basic-app/src/pages/Layout.ave`

**Interfaces:**
- Consumes: existing routes / nav hrefs
- Produces: dark readable chrome for all lab pages

- [ ] **Step 1: Update `examples/basic-app/src/app.html` head** — keep existing favicon/OG tags; add after viewport:

```html
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#09090B" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Replace `Layout.ave` styles + nav chrome with:**

```ave
<script lang="ts">
  export let children
</script>

<style>
  :global(:root) {
    --bg: #09090b;
    --fg: #fafafa;
    --muted: #a1a1aa;
    --accent: #06b6d4;
    --accent-deep: #0891b2;
    --line: rgba(250, 250, 250, 0.12);
    --font: 'Syne', sans-serif;
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font);
  }

  :global(a) {
    color: var(--accent);
  }

  .shell {
    min-height: 100vh;
  }

  .topnav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem 1rem;
    padding: 0.85rem clamp(1rem, 3vw, 2rem);
    border-bottom: 1px solid var(--line);
    font-size: 0.8rem;
    font-weight: 500;
  }

  .topnav a {
    color: var(--muted);
    text-decoration: none;
  }

  .topnav a:hover {
    color: var(--fg);
  }

  .body {
    /* Home owns its padding; lab pages get a readable column */
  }

  :global(.shell > :not(.topnav):not(main.stage)) {
    display: block;
    max-width: 42rem;
    margin: 0 auto;
    padding: 1.5rem clamp(1rem, 3vw, 2rem);
  }
</style>

<template>
  <div class="shell">
    <nav class="topnav" aria-label="Example labs">
      <a href="/">Home</a>
      <a href="/docs/intro">Docs</a>
      <a href="/posts/1">Post</a>
      <a href="/stream">Stream</a>
      <a href="/login">Login</a>
      <a href="/admin">Admin</a>
    </nav>
    <slot />
  </div>
</template>
```

Note: If `:global(.shell > :not(...))` is awkward with how Layout wraps children, prefer a simpler rule — lab pages keep their own margins, and only set `body` colors. Prefer working CSS over clever selectors; simplify to body + `.topnav` only if the child selector fights the Home full-bleed stage.

**Preferred simplification if Home is full-bleed:** do **not** constrain Home; use Home’s `.stage` for padding. Lab pages that look cramped can add local padding later. So Layout may be only:

```ave
<style>
  /* tokens + body + .topnav as above; no .body column rule */
</style>
```

- [ ] **Step 3: Open example in browser or curl home after Task 4**

---

### Task 4: Example `Home.ave` aligned with template

**Files:**
- Modify: `examples/basic-app/src/pages/Home.ave`

**Interfaces:**
- Consumes: Layout dark tokens; existing `actions.login` + `redirect`
- Produces: same hero/demo as template; login as secondary control under demo

- [ ] **Step 1: Replace `Home.ave` with template-equivalent UI**, keeping server login action:

Use the same client script / styles / markup as Task 2, with these differences:

1. Keep server block:

```ave
<script server>
  import { redirect } from '@avedon/server'

  export async function load() {
    return { title: 'avedon' }
  }

  export const actions = {
    login: async ({ session }) => {
      session!.set({ demo: true })
      return redirect('/admin')
    },
  }
</script>
```

2. Secondary CTA: `<a class="cta-secondary" href="/docs/intro">Docs</a>` (not GitHub-only).

3. Under `.demo`, add:

```ave
<form method="POST" action="?/login" class="demo-login">
  <button type="submit">Demo login → /admin</button>
</form>
```

With styles:

```css
  .demo-login {
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--line);
  }

  .demo-login button {
    font: inherit;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 0.4rem 0.7rem;
    border-radius: 0.3rem;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .demo-login button:hover {
    color: var(--fg);
    border-color: var(--fg);
  }
```

4. Do **not** duplicate `:global(html), :global(body)` if Layout already sets them — keep tokens on Home only if needed for scoped demo, or rely on Layout `:root` / `body`. Avoid fighting Layout: Home styles focus on `.stage` and children; drop Home’s `:global(html/body)` when Layout owns them.

- [ ] **Step 2: Manual verify**

Run: `pnpm -F example dev` (or use existing server)  
Open: `http://localhost:5173/`  
Expected: dark stage, huge `avedon`, counter increments, nav muted, login under demo.

- [ ] **Step 3: Run unit/smoke subset**

Run: `pnpm -F create-avedon-app test && pnpm exec vitest run packages/compiler/src/compile.test.ts`
Expected: PASS

---

### Task 5: Spec status + memories note

**Files:**
- Modify: `docs/superpowers/specs/2026-07-21-starter-home-design.md` — set `Status: Implemented (2026-07-21)`
- Modify: `memories.md` — one bullet under Status about starter home redesign

- [ ] **Step 1: Update status lines**
- [ ] **Step 2: Ask user whether to commit** (do not commit unless they ask)

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Dark palette tokens | 2, 3, 4 |
| Syne font / not Inter | 1, 3 |
| Brand + headline + support + CTAs | 2, 4 |
| Signal mini demo | 2, 4 |
| Atmosphere (grid + soft cyan wash) | 2, 4 |
| Motion + reduced-motion | 2, 4 |
| Template + basic-app both | 1–4 |
| Quiet lab nav / login not primary CTA | 3, 4 |
| No new deps | all |
| Success: smoke / create tests | 2, 4 |

No placeholders remain in task code blocks.
