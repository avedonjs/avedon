# Pre-Publish Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the pre-npm-publish gate: repo housekeeping, BUG-010 threat-model decision + publish-blocking mitigation, GitHub branch protection, then first public npm release; defer non-blocking quality bugs to post-publish.

**Architecture:** Ordered release gate on `main`. Security fixes for the July 22 audit are already on `main` (`babdfa0`). This plan (1) cleans audit/build hygiene, (2) locks BUG-010 as a documented trusted-layout contract with a safer client slot insertion path and docs, (3) requires CI/CodeQL before merges, (4) publishes `0.1.0` via Changesets + `NPM_TOKEN`, then (5) fixes deferred perf/dev-only bugs that must not block publish.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, GitHub Actions, Changesets, `gh` CLI

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer asks (or when a plan step explicitly says to commit and the maintainer has already approved execution)
- TypeScript stays on 5.x (do not bump to 6)
- English-only docs
- Do not implement Cloudflare/Bun adapters, docs landing site, typed route DX, or broad Playwright expansion in this plan (separate plans later)
- Do not treat Release `ENEEDAUTH` as a product regression until Task 4 completes

## Out of scope (later plans)

- Docs/landing site
- Typed `load` / `actions` / `params` DX
- Broad Playwright e2e expansion
- `@avedon/adapter-cloudflare` / `@avedon/adapter-bun` implementations

## File map

| Path | Responsibility |
|------|----------------|
| `bug_report_2026-07-22.md`, `bug_data_2026-07-22.json`, `bug_config_2026-07-22.yaml`, `bugs_2026-07-22.csv` | Move under `docs/superpowers/audits/2026-07-22/` or delete from git |
| `.gitignore` | Ignore `examples/**/.ave/`, `*.tsbuildinfo` |
| `memories.md` | Sync status / next-steps |
| `packages/compiler/src/codegen.ts` | Client `<slot>` insertion (BUG-010) |
| `packages/compiler/src/compile.test.ts` | Slot / children compile assertions |
| `docs/routing.md` (or new `docs/security.md`) | BUG-010 threat model for authors |
| `bug_report_2026-07-22.md` (relocated) | Mark BUG-010 publish-gate status |
| GitHub branch protection (API) | Require CI + CodeQL + Smoke |
| `.changeset/*.md` | First release changelog entry |
| `packages/*/package.json` | Version bumps via Changesets |

## BUG-010 threat model (locked for this plan)

Evidence from current code:

1. **SSR pipeline (trusted):** `packages/server/src/pipeline.ts` passes `children` as a writer function or as HTML produced by the child component render — not end-user input.
2. **Normal client boot (does not remount layouts):** `packages/vite-plugin` client entry mounts only the **leaf** route component into `[data-avedon-page]` / `[data-avedon-csr]`. Layout chrome stays as SSR DOM; `Layout.mount({ children })` is not used on the happy path.
3. **Public API (XSS footgun):** Every compiled `.ave` exports `mount(target, props?)` / `hydrate` / `update` with `props?: Record<string, unknown>`. Client slot codegen does `template.innerHTML = String(__props.children ?? '')`. An app that calls `Layout.mount(el, { children: untrusted })` or `update({ children: untrusted })` has an HTML injection sink.

**Publish-gate decision:** Treat layout `children` as a **trusted framework contract**. Do **not** add a sanitizer dependency. Before first publish: (a) document the contract, (b) harden client slot to accept `Node` / `DocumentFragment` without `innerHTML`, (c) keep string → `<template>.innerHTML` only for trusted framework HTML and state that explicitly in docs + codegen comment. Post-publish may add a stricter DocumentFragment-only API if needed.

---

### Task 1: Housekeeping (audit artefacts + ignore junk)

**Files:**
- Move: `bug_report_2026-07-22.md`, `bug_data_2026-07-22.json`, `bug_config_2026-07-22.yaml`, `bugs_2026-07-22.csv` → `docs/superpowers/audits/2026-07-22/`
- Modify: `.gitignore`
- Modify: `memories.md`
- Do not commit: `examples/basic-app/.ave/**`, `packages/shared/tsconfig.tsbuildinfo`

**Interfaces:**
- Consumes: existing audit files already on `main` from `babdfa0`
- Produces: audits under `docs/superpowers/audits/2026-07-22/`; gitignore rules that keep build caches out of git

- [x] **Step 1: Create audit archive directory and move files**

```bash
mkdir -p docs/superpowers/audits/2026-07-22
git mv bug_report_2026-07-22.md bug_data_2026-07-22.json bug_config_2026-07-22.yaml bugs_2026-07-22.csv docs/superpowers/audits/2026-07-22/
```

Expected: four files under `docs/superpowers/audits/2026-07-22/`; no `bug_*` at repo root.

- [x] **Step 2: Append ignore rules to `.gitignore`**

If `.gitignore` lacks these patterns, append:

```gitignore
# Local build / typecheck artefacts
examples/**/.ave/
*.tsbuildinfo
```

- [x] **Step 3: Update `memories.md` Status**

Replace the stale “Not committed yet” fix-round bullet with:

```markdown
- **Fix round (2026-07-22):** committed as `babdfa0` (path traversal, pack smoke, audit remediations). Audit artefacts relocated under `docs/superpowers/audits/2026-07-22/`.
- **Pre-publish gate plan:** `docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md`
```

Keep the Next steps section aligned with: housekeeping → BUG-010 → branch protection → publish → 3b.

- [x] **Step 4: Verify working tree hygiene**

```bash
git status --short
```

Expected: only intentional paths (moved audits, `.gitignore`, `memories.md`, this plan). No `examples/basic-app/.ave/` staged.

- [x] **Step 5: Commit (when maintainer asks)**

```bash
git add docs/superpowers/audits/2026-07-22 .gitignore memories.md docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md
git commit -m "$(cat <<'EOF'
chore: archive audit artefacts and ignore local build caches.

EOF
)"
```

---

### Task 2: BUG-010 — document + harden client `<slot>`

**Files:**
- Modify: `packages/compiler/src/codegen.ts` (client `t.type === 'slot'` branch ~589–597)
- Modify: `packages/compiler/src/compile.test.ts`
- Create or modify: `docs/security.md` (preferred) **and** add one link from `docs/README.md` + one sentence in `docs/routing.md` Layouts section
- Modify: `docs/superpowers/audits/2026-07-22/bug_report_2026-07-22.md` (BUG-010 status note)

**Interfaces:**
- Consumes: current slot emit that always uses `innerHTML`
- Produces: client slot emit that appends `Node`/`DocumentFragment` directly; strings still use `<template>` with an explicit trusted-contract comment; docs describing the threat model

- [ ] **Step 1: Write the failing compile test**

Add to `packages/compiler/src/compile.test.ts`:

```ts
it('client slot accepts Node children without stringifying via innerHTML only', () => {
  const { code } = compile(
    `<script>export let children</script><template><div class="wrap"><slot /></div></template>`,
    { filename: 'Layout.ave' },
  )
  expect(code).toContain('instanceof Node')
  expect(code).toContain("createElement('template')")
  expect(code).toMatch(/trusted framework|trusted HTML|framework-produced/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @avedon/compiler exec vitest run src/compile.test.ts -t "client slot accepts Node"
```

Expected: FAIL — compiled output lacks `instanceof Node` (and/or trusted comment regex).

- [ ] **Step 3: Implement client slot hardening in `codegen.ts`**

Replace the client `slot` branch in `emitClientNodes` with:

```ts
} else if (t.type === 'slot') {
  // Layout `children` is a trusted framework contract (SSR pipeline HTML or Node).
  // Public mount/update must not pass untrusted strings — see docs/security.md.
  lines.push(`{
        const __ch = __props.children;
        if (__ch instanceof Node) {
          ${parent}.appendChild(__ch);
        } else if (__ch != null && __ch !== '') {
          const ${id} = document.createElement('template');
          ${id}.innerHTML = String(__ch);
          ${parent}.appendChild(${id}.content);
        }
      }`)
}
```

Do **not** change SSR emit (`(__props.children ?? '')` / `__pipeChildren`) in this task.

- [ ] **Step 4: Run compile tests**

```bash
pnpm -F @avedon/compiler exec vitest run src/compile.test.ts
pnpm test
```

Expected: PASS (including new slot test); full unit suite green.

- [ ] **Step 5: Write `docs/security.md`**

Create `docs/security.md`:

```markdown
# Security notes

## Layout \`children\` / \`<slot />\` (trusted HTML)

avedon layouts receive page content through \`children\` / \`<slot />\`.

**Trusted sources (safe by framework contract):**

- SSR/streaming pipeline output (child \`render\` / stream writers)
- A \`Node\` or \`DocumentFragment\` you built yourself and pass into \`mount\` / \`update\`

**Unsafe:**

- Passing an untrusted string (for example request body, query, CMS HTML you have not sanitized) as \`children\` into \`mount\`, \`hydrate\`, or \`update\`

Client codegen inserts string \`children\` via a \`<template>\` element's \`innerHTML\`. That path intentionally trusts the string. If you need to render untrusted markup, sanitize it with a dedicated HTML sanitizer **before** it becomes \`children\`, or pass a DOM \`Node\` you constructed safely (for example \`document.createTextNode\`).

Normal client boot only remounts the leaf page into \`[data-avedon-page]\`; it does not remount layouts with string \`children\`. The footgun is the public per-component \`mount\` / \`update\` API.
```

- [ ] **Step 6: Link docs**

In `docs/README.md` table, add a row:

```markdown
| [Security](./security.md) | Trusted layout children, reporting |
```

In `docs/routing.md` under `## Layouts`, append:

```markdown
Layout \`children\` / \`<slot />\` are a **trusted HTML** contract — see [Security](./security.md).
```

- [ ] **Step 7: Update relocated bug report**

In `docs/superpowers/audits/2026-07-22/bug_report_2026-07-22.md`, change BUG-010 Status from Deferred to:

`Publish-gate: threat model documented; client Node path + trusted-string contract (no sanitizer).`

Update Remaining risk item 2 accordingly.

- [ ] **Step 8: Commit (when maintainer asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.test.ts docs/security.md docs/README.md docs/routing.md docs/superpowers/audits/2026-07-22/bug_report_2026-07-22.md
git commit -m "$(cat <<'EOF'
fix(compiler): clarify trusted layout children and accept Node slots.

EOF
)"
```

---

### Task 3: Branch protection on `main`

**Files:**
- None in git (GitHub settings). Optional: one sentence in `CONTRIBUTING.md` if the required check **names** differ from the table.

**Interfaces:**
- Consumes: workflow job names from `.github/workflows/{ci,e2e,codeql}.yml`
- Produces: protected `main` that cannot merge without required checks

Required status check **names** (must match Actions check names exactly):

| Required check name | Workflow |
|---------------------|----------|
| `Install` | CI |
| `Typecheck` | CI |
| `Build` | CI |
| `Test` | CI |
| `Smoke tests` | E2E / Smoke |
| `Analyze` | CodeQL |

- [ ] **Step 1: Confirm current protection is off**

```bash
gh api repos/avedonjs/avedon/branches/main/protection
```

Expected: HTTP 404 `Branch not protected` (current state as of plan writing).

- [ ] **Step 2: Apply protection via API**

Requires admin on `avedonjs/avedon`. Run:

```bash
gh api repos/avedonjs/avedon/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Install",
      "Typecheck",
      "Build",
      "Test",
      "Smoke tests",
      "Analyze"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": false
}
EOF
```

If the org requires pull-request reviews for public repos, raise `required_approving_review_count` to `1` instead of `0`.

If the API rejects `contexts` in favor of check `checks` objects on newer GitHub APIs, use the GitHub UI: **Settings → Branches → Add rule → `main`**, enable **Require status checks to pass before merging**, select the six names above, enable **Require branches to be up to date**, disable force pushes.

- [ ] **Step 3: Verify**

```bash
gh api repos/avedonjs/avedon/branches/main/protection --jq '.required_status_checks.contexts'
```

Expected: JSON array containing the six check names.

- [ ] **Step 4: Note in memories (no separate commit required if bundled with Task 2/4)**

Add under Status:

```markdown
- **Branch protection (2026-07-22):** `main` requires Install, Typecheck, Build, Test, Smoke tests, Analyze.
```

---

### Task 4: First npm publish

**Files:**
- Create: `.changeset/pre-publish-0-1-0.md` (or whatever Changesets generates)
- Modify: package versions via `pnpm changeset version` (through the Version Packages PR **or** local version then publish — prefer the Release workflow)

**Interfaces:**
- Consumes: `NPM_TOKEN` secret; packages already at `0.1.0` with `"access": "public"` in `.changeset/config.json`
- Produces: published `avedon`, `create-avedon-app`, and `@avedon/*` on npm with provenance

- [ ] **Step 1: Prerequisites checklist (manual)**

1. npm account can publish under scope `@avedon` and package names `avedon`, `create-avedon-app`.
2. Create a granular npm token with publish rights.
3. GitHub → **Settings → Secrets and variables → Actions** → secret `NPM_TOKEN`.
4. Confirm Task 3 protection is on so the Version Packages PR cannot merge red.

- [ ] **Step 2: Add an initial changeset**

```bash
pnpm changeset
```

Select all publishable packages (`avedon`, `create-avedon-app`, `@avedon/compiler`, `@avedon/runtime`, `@avedon/server`, `@avedon/vite-plugin`, `@avedon/adapter-node`, `@avedon/adapter-bun`, `@avedon/adapter-cloudflare`, `@avedon/shared` if published). Choose **patch** (keeps `0.1.0` → `0.1.1`) **or** if packages are unpublished and should stay `0.1.0`, use Changesets empty/first-publish flow:

Preferred for never-published `0.1.0`: create a changeset with summary only; when Release runs `changeset publish`, unpublished `0.1.0` packages publish at `0.1.0`.

Changeset body example:

```markdown
---
"avedon": patch
"create-avedon-app": patch
"@avedon/compiler": patch
"@avedon/runtime": patch
"@avedon/server": patch
"@avedon/vite-plugin": patch
"@avedon/adapter-node": patch
"@avedon/adapter-bun": patch
"@avedon/adapter-cloudflare": patch
"@avedon/shared": patch
---

Initial public release of the avedon framework packages.
```

If `@avedon/shared` is private / not publishable, omit it and match `packages/*/package.json` `"private"` flags.

- [ ] **Step 3: Commit changeset (when maintainer asks)**

```bash
git add .changeset
git commit -m "$(cat <<'EOF'
chore: add changeset for initial npm release.

EOF
)"
git push origin main
```

- [ ] **Step 4: Let Release open Version Packages PR; merge only when green**

1. Wait for workflow **Release** / job **Version & publish** to open `chore: version packages`.
2. Confirm required checks are green on that PR.
3. Merge the PR (protection must enforce checks).
4. Release workflow publishes to npm on the version commit.

- [ ] **Step 5: Verify publish**

```bash
npm view avedon version
npm view @avedon/compiler version
npm view create-avedon-app version
```

Expected: versions matching the Version Packages commit (for example `0.1.0` or `0.1.1`).

- [ ] **Step 6: Smoke from registry (optional but recommended)**

```bash
cd /tmp
pnpm create avedon-app avedon-publish-smoke --yes
cd avedon-publish-smoke && pnpm install && pnpm build
```

Expected: scaffold installs published packages and builds.

- [ ] **Step 7: Update memories Status**

```markdown
- **npm (2026-07-22):** first publish complete; `NPM_TOKEN` configured; Release green.
```

---

### Task 5 (post-publish): BUG-004 nested effect leak

**Files:**
- Modify: `packages/compiler/src/codegen.ts` (`{#if}` / `{#each}` client emit ~604–643)
- Modify: `packages/compiler/src/compile.ts` only if mount teardown needs a disposer list
- Test: `packages/compiler/src/compile.test.ts` (assert nested local effect arrays / dispose calls in generated code)

**Interfaces:**
- Consumes: current pattern — nested `emitClientNodes` pushes into the outer `__effects` array; replacing a block leaves stale effect fns running
- Produces: per-block local effect list disposed before replace; parent `__effects` only holds the block runner

- [ ] **Step 1: Write failing test for generated dispose pattern**

```ts
it('nested if/each effects dispose previous nodes\\' effect runners', () => {
  const { code } = compile(
    `<script>import { signal } from '@avedon/runtime'
const on = signal(true)
const items = signal([1,2])
</script>
<template>{#if on}{#each items as n}<span>{n}</span>{/each}{/if}</template>`,
    { filename: 'Nested.ave' },
  )
  expect(code).toMatch(/__blockEffects|__localEffects|dispose/)
})
```

Adjust the expected identifier to whatever Step 3 chooses; keep the test failing until codegen emits a dispose mechanism.

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm -F @avedon/compiler exec vitest run src/compile.test.ts -t "nested if/each"
```

- [ ] **Step 3: Implement minimal dispose scoping**

In `{#if}` / `{#each}` client emitters, use a local array cleared on each run, for example:

```ts
let __nodes = [];
let __blockEffects = [];
__effects.push(() => {
  for (const stop of __blockEffects) stop();
  __blockEffects = [];
  for (const n of __nodes) n.remove();
  __nodes = [];
  const __frag = document.createDocumentFragment();
  const __effects = __blockEffects; // shadow: nested emitClientNodes push disposers here
  // ... existing emitClientNodes into __frag ...
  // convert pushed effect fns into run+store disposers, or push wrappers that register into __blockEffects
});
```

Concrete approach (pick one and keep it consistent):

**Preferred:** change `emitClientNodes` to accept an effects-array name parameter (default `__effects`). For if/each body emits, pass `__blockEffects`. On each block rerun, invoke previous runners' cleanup if you store `() => void` disposers; for today's effect style (fn in array re-run on invalidate), clear by **not** leaving nested fns in the parent `__effects` — only the block's single parent runner stays in parent `__effects`.

Also update `destroy()` in `compile.ts` mount return to run any remaining cleanups if you introduce disposers:

```ts
destroy() {
  for (const stop of __disposers) stop();
  target.textContent = '';
},
```

Only add `__disposers` if Step 3 introduces them; otherwise keep `destroy` as-is.

- [ ] **Step 4: Run tests**

```bash
pnpm -F @avedon/compiler test
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit (when maintainer asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.ts packages/compiler/src/compile.test.ts
git commit -m "$(cat <<'EOF'
fix(compiler): dispose nested if/each block effects on replace.

EOF
)"
```

---

### Task 6 (post-publish): BUG-006 HMR signal rewrite ReDoS

**Files:**
- Modify: `packages/compiler/src/compile.ts` (`injectSignalHmrKeys` ~314–322)
- Test: `packages/compiler/src/hmr-signal.test.ts`

**Interfaces:**
- Consumes: `script.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*signal\s*\(([\s\S]*?)\)\s*;?/g, ...)`
- Produces: linear scan that finds `signal(` calls without nested `[\s\S]*?` backtracking; **dev/HMR only** (`hmr: true`)

- [ ] **Step 1: Write failing test for nested parens / no quadratic trap**

Add to `packages/compiler/src/hmr-signal.test.ts`:

```ts
it('injects hmr keys with nested parentheses in signal init', () => {
  const { code } = compile(
    `<script>
  import { signal } from '@avedon/runtime'
  const likes = signal(Math.max(0, data.post.likes))
</script>
<template><p>{likes}</p></template>`,
    { filename: 'Sig.ave', hmr: true },
  )
  expect(code).toContain('signal(Math.max(0, data.post.likes), "likes")')
})
```

- [ ] **Step 2: Run test**

```bash
pnpm -F @avedon/compiler exec vitest run src/hmr-signal.test.ts
```

Expected: may already PASS with current regex; if PASS, keep the test and still replace the implementation in Step 3 (regression lock). If FAIL, proceed.

- [ ] **Step 3: Replace `injectSignalHmrKeys` with a linear scanner**

```ts
function injectSignalHmrKeys(script: string): string {
  const re = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*signal\s*\(/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(script))) {
    const startArgs = m.index + m[0].length
    let depth = 1
    let i = startArgs
    for (; i < script.length; i++) {
      const c = script[i]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0) break
    const args = script.slice(startArgs, i)
    out += script.slice(last, m.index)
    if (hasTopLevelComma(args)) {
      out += script.slice(m.index, i + 1)
    } else {
      out += `${m[1]} ${m[2]} = signal(${args.trim()}, ${JSON.stringify(m[2])})`
    }
    last = i + 1
    re.lastIndex = last
  }
  out += script.slice(last)
  return out
}
```

Keep existing `hasTopLevelComma` helper.

- [ ] **Step 4: Run HMR + full tests**

```bash
pnpm -F @avedon/compiler exec vitest run src/hmr-signal.test.ts src/prod-hmr-leak.test.ts
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit (when maintainer asks)**

```bash
git add packages/compiler/src/compile.ts packages/compiler/src/hmr-signal.test.ts
git commit -m "$(cat <<'EOF'
fix(compiler): scan signal() HMR keys linearly instead of lazy regex.

EOF
)"
```

- [ ] **Step 6: Final gate verification after Tasks 5–6**

```bash
pnpm build && pnpm test && pnpm test:smoke
```

Expected: all green. Update audit deferred list: BUG-004 and BUG-006 fixed.

---

## Self-review

1. **Spec coverage:** Agreed sequence 1(+5) → 3a BUG-010 → 4 branch protection → 2 publish → 3b → later items. Tasks 1–6 map 1:1; later items explicitly out of scope.
2. **Placeholder scan:** No TBD/TODO steps; commands and code included.
3. **Type consistency:** Slot uses `__props.children`; mount API remains `Record<string, unknown>`; Node check is runtime `instanceof Node`.
4. **Commit steps:** Present but gated on maintainer ask (project preference).
