# `@avedon/adapter-bun` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bun adapter stub with a Node-parity `Bun.serve` server: safe static files, SSG HTML, ISR stale-while-revalidate, and `createHandler` for everything else.

**Architecture:** Mirror `@avedon/adapter-node`’s `adapt()` output layout (`out/client`, `out/server.js`). Implement Bun-native `tryServeSsgIsrBun` returning `Response | null` using `@avedon/server`’s `isStale` / `renderSsgPage` / `createPathLock`. Copy `safe-path.ts` from the Node adapter (keep tests in sync) to avoid coupling `adapter-bun` → `adapter-node`.

**Tech Stack:** TypeScript, Vitest, Bun runtime (optional in CI), `@avedon/server`, `@avedon/shared`

**Spec:** `docs/superpowers/specs/2026-07-23-adapter-bun-design.md`

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer explicitly asks
- TypeScript 5.x only
- English-only docs
- Node ISR parity (SWR); not Cloudflare’s “no ISR” model
- Do not import Node `tryServeSsgIsr` (Node `http` types)
- Duplicate `safe-path` is OK for v1
- Smoke must pass artifact checks without Bun; runtime ping only if `bun` is on PATH

---

## File map

| Path | Responsibility |
|------|----------------|
| `packages/adapter-bun/src/safe-path.ts` | Copy from Node |
| `packages/adapter-bun/src/safe-path.test.ts` | Same cases as Node |
| `packages/adapter-bun/src/ssg-isr.ts` | Bun ISR → `Response \| null` |
| `packages/adapter-bun/src/ssg-isr.test.ts` | Unit tests for SWR / atomic write |
| `packages/adapter-bun/src/index.ts` | `bunAdapter` + generated `Bun.serve` source |
| `packages/adapter-bun/src/adapt.test.ts` | Artifact layout tests |
| `packages/adapter-bun/package.json` | Deps + vitest |
| `packages/adapter-bun/vitest.config.ts` | `include: ['src/**/*.test.ts']` |
| `packages/adapter-bun/README.md` | Usage |
| `docs/deployment.md` / `docs/configuration.md` | Bun section |
| `e2e/bun-adapt-smoke.mjs` | Build smoke + optional Bun runtime |
| `package.json` | Append to `test:smoke` |
| `memories.md` | Status |

---

### Task 1: `safe-path` + Bun ISR

**Files:**
- Create: `packages/adapter-bun/src/safe-path.ts` (copy from `packages/adapter-node/src/safe-path.ts`)
- Create: `packages/adapter-bun/src/safe-path.test.ts` (copy from Node’s test; fix imports)
- Create: `packages/adapter-bun/src/ssg-isr.ts`
- Create: `packages/adapter-bun/src/ssg-isr.test.ts`
- Modify: `packages/adapter-bun/package.json` (add `@avedon/server`, vitest, test script)
- Create: `packages/adapter-bun/vitest.config.ts`
- Modify: `packages/adapter-bun/tsconfig.json` (exclude `*.test.ts` like Node)

**Interfaces:**
- Produces:
  - `resolveUnderRoot(root, pathname): string | null`
  - `ssgHtmlPathSafe(clientDir, pathname): string | null`
  - `tryServeSsgIsrBun(opts): Promise<Response | null> | Response | null` — prefer **sync return of Response** with async regen fire-and-forget (match Node sync API): `tryServeSsgIsrBun(opts): Response | null`
  - `writeHtmlAtomic(file, html): void`
  - `isRegenerating(pathname): boolean`

```ts
// ssg-isr.ts shape
export type ServeSsgIsrBunOptions = {
  request: Request
  clientDir: string
  pathname: string
  routes: Routes
  appHtml: string
  clientEntry?: string
}

export function tryServeSsgIsrBun(opts: ServeSsgIsrBunOptions): Response | null
```

Logic mirrors Node `tryServeSsgIsr`, but returns:

```ts
if (opts.request.method === 'HEAD') {
  return new Response(null, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
const html = fs.readFileSync(file, 'utf8')
return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
```

(Or `Bun.file(file)` when generating server source — unit tests can use `fs.readFileSync` in the library used by generated code via inlined helpers imported from `@avedon/adapter-bun`.)

**Important:** Generated `server.js` should import `tryServeSsgIsrBun` and `resolveUnderRoot` from `@avedon/adapter-bun` (same pattern as Node imports from `@avedon/adapter-node`), not inline ISR.

- [ ] **Step 1: Copy safe-path + tests; add package scripts/deps**

- [ ] **Step 2: Write `ssg-isr.test.ts` failing cases**

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tryServeSsgIsrBun, writeHtmlAtomic, isRegenerating } from './ssg-isr.js'

describe('tryServeSsgIsrBun', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avedon-bun-isr-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('returns null when no file', () => {
    const res = tryServeSsgIsrBun({
      request: new Request('http://localhost/missing'),
      clientDir: tmp,
      pathname: '/missing',
      routes: [{ path: '/missing', render: 'ssg', component: { render: () => '' } }],
      appHtml: '<html>%avedon.body%</html>',
    })
    expect(res).toBeNull()
  })

  it('serves on-disk HTML for SSG path', async () => {
    const file = path.join(tmp, 'index.html')
    fs.writeFileSync(file, '<html>home</html>')
    const res = tryServeSsgIsrBun({
      request: new Request('http://localhost/'),
      clientDir: tmp,
      pathname: '/',
      routes: [{ path: '/', render: 'ssg', getStaticPaths: () => ['/'], component: { render: () => 'x' } }],
      appHtml: '<html>%avedon.body%</html>',
    })
    expect(res).not.toBeNull()
    expect(await res!.text()).toContain('home')
  })
})
```

Adjust route fixture types to match real `Routes` / `AvedonComponentModule` shapes used in Node ISR tests (`packages/server/src/isr.test.ts` / adapter-node tests) — copy a minimal working fixture from there if the above types fail.

- [ ] **Step 3: Implement `ssg-isr.ts`**

- [ ] **Step 4: Run tests**

```bash
pnpm install
pnpm -F @avedon/adapter-bun test
```

Expected: PASS.

- [ ] **Step 5: Commit (when asked)**

```bash
git add packages/adapter-bun
git commit -m "$(cat <<'EOF'
feat(adapter-bun): add safe-path and Bun ISR helpers.

EOF
)"
```

---

### Task 2: `bunAdapter` + generated `Bun.serve` server

**Files:**
- Modify: `packages/adapter-bun/src/index.ts`
- Create: `packages/adapter-bun/src/adapt.test.ts`
- Modify: `packages/adapter-bun/package.json` `build` entry if multiple files needed — **tsup must bundle all entry exports**:

```json
"build": "tsup src/index.ts --format esm --dts --clean"
```

Ensure `index.ts` re-exports `tryServeSsgIsrBun`, `resolveUnderRoot`, `ssgHtmlPathSafe`, `writeHtmlAtomic` so the generated server can import them from `@avedon/adapter-bun`.

**Interfaces:**
- `bunAdapter({ out?: string }): AdapterInterface`
- Generated server imports:
  - `createHandler` from `@avedon/server`
  - `tryServeSsgIsrBun`, `resolveUnderRoot` from `@avedon/adapter-bun`
  - app from relative SSR entry

- [ ] **Step 1: Failing adapt test**

Assert `adapt()` writes `client/` files, SSG HTML, and `server.js` containing `Bun.serve`, `createHandler`, `tryServeSsgIsrBun`.

- [ ] **Step 2: Implement `bunAdapter` + `bunServerSource`**

`adapt()` same structure as Node (writeClient, SSG loop, write `server.js`).

Generated fetch handler sketch:

```js
Bun.serve({
  port: Number(process.env.PORT || 3000),
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const rawPath = url.pathname;
      const filePath = resolveUnderRoot(clientDir, rawPath);
      if (filePath === null) return new Response('Forbidden', { status: 403 });
      const file = Bun.file(filePath);
      if (await file.exists() && request.method === 'GET') {
        // Prefer static assets; directories: Bun.file on dirs may not apply — check with stat
        return new Response(file);
      }
      const isr = tryServeSsgIsrBun({
        request,
        clientDir,
        pathname: url.pathname,
        routes,
        appHtml,
        clientEntry,
      });
      if (isr) return isr;
      return handler(request);
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});
console.log('avedon listening on http://localhost:' + (process.env.PORT || 3000));
```

Refine directory check: use `existsSync` + `statSync` like Node (`isDir`) before serving `Bun.file`, because serving a directory is wrong.

Also handle HEAD for static files.

- [ ] **Step 3: Build + test**

```bash
pnpm -F @avedon/adapter-bun test
pnpm -F @avedon/adapter-bun build
pnpm -F @avedon/adapter-bun typecheck
```

- [ ] **Step 4: Commit (when asked)**

```bash
git commit -m "$(cat <<'EOF'
feat(adapter-bun): emit Bun.serve production server.

EOF
)"
```

---

### Task 3: Docs + smoke

**Files:**
- `packages/adapter-bun/README.md`
- `docs/deployment.md` — replace Bun stub
- `docs/configuration.md` — `bunAdapter` example
- `e2e/bun-adapt-smoke.mjs`
- `examples/basic-app/package.json` — add `@avedon/adapter-bun` workspace dep
- root `package.json` — append smoke
- `memories.md`

- [ ] **Step 1: Docs** (mirror Cloudflare/Node style)

- [ ] **Step 2: Smoke script**

Same pattern as `e2e/cloudflare-adapt-smoke.mjs`: backup `avedon.config.ts`, write `bunAdapter`, `avedon build`, assert `build/server.js` contains `Bun.serve`, restore config, delete `build/`.

If `bun` exists:

```js
// spawn bun build/server.js, fetch /, expect 200 + brand, kill
```

Else log skip.

- [ ] **Step 3: Run**

```bash
pnpm build
node e2e/bun-adapt-smoke.mjs
```

- [ ] **Step 4: memories** — mark 9c done; next = optional custom domain / create-app flag / NPM_TOKEN proof

- [ ] **Step 5: Commit (when asked)**

---

## Self-review (plan vs spec)

| Spec | Task |
|------|------|
| Bun.serve + createHandler | Task 2 |
| Safe static paths | Task 1 + 2 |
| ISR SWR parity | Task 1 |
| Docs | Task 3 |
| Smoke optional Bun | Task 3 |
| No stub | Task 2 |

No placeholders.
