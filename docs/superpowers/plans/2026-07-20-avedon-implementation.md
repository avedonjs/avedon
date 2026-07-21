# avedon Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working avedon monorepo: `.ave` compiler, Angular-style `routes.ts`, load/actions/api, hybrid SSR/SSG/CSR, Vite plugin, Node adapter, CLI, example app, and tests.

**Architecture:** Vite-centric monorepo. `@avedon/compiler` splits `.ave` into client/server modules and compiles templates to SSR HTML + client mount functions. `@avedon/server` matches `routes.ts` and runs the Web Standards request pipeline. `@avedon/adapter-node` packages production output.

**Tech Stack:** TypeScript, Vite 6, Node 20+, Vitest, Playwright, npm workspaces

## Global Constraints

- TypeScript-first; package `"type": "module"`
- No file-based routing; only `routes.ts`
- Server code from `<script server>` never in client bundles
- API keys absolute from site root (`GET /api/items`)
- Default render mode `ssr`
- First adapter: Node only
- Do not commit unless user asks

## File map

```
package.json                 # workspaces root
tsconfig.base.json
packages/compiler/           # parse + codegen
packages/runtime/            # stores, mount helpers
packages/server/             # routes, pipeline, errors
packages/vite-plugin/        # .ave transform
packages/adapter-node/       # adapt() + node server template
packages/cli/                # CLI (avedon)
examples/basic/              # demo app
docs/guide.md                # user-facing docs
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/src/index.ts`

- [ ] **Step 1:** Create root workspace `package.json` with workspaces `packages/*`, `examples/*`, scripts `build`, `test`
- [ ] **Step 2:** Scaffold empty packages: `compiler`, `runtime`, `server`, `vite-plugin`, `adapter-node`, `avedon` (CLI)
- [ ] **Step 3:** `npm install` at root; verify workspace links

---

### Task 2: `@avedon/runtime`

**Files:**
- Create: `packages/runtime/src/index.ts`, `packages/runtime/src/store.ts`, `packages/runtime/src/component.ts`
- Test: `packages/runtime/src/store.test.ts`

**Produces:** `writable`, `readable`, `get`, `mount`, `hydrate`

- [ ] **Step 1:** Implement `writable`/`readable` stores
- [ ] **Step 2:** Vitest for store subscribe/set
- [ ] **Step 3:** Export mount/hydrate helpers used by compiled output

---

### Task 3: `@avedon/compiler`

**Files:**
- Create: `packages/compiler/src/parse.ts`, `compile.ts`, `codegen.ts`, `index.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Produces:** `compile(source, filename) => { clientCode, serverCode, css, warnings }`

- [ ] **Step 1:** Parse `<script>`, `<script server>`, `<style>`, remainder as markup
- [ ] **Step 2:** Codegen client module (component class + SSR `render` + `mount`)
- [ ] **Step 3:** Codegen server module exporting `load`/`actions`/`api` from server script
- [ ] **Step 4:** Scope CSS with hash attribute
- [ ] **Step 5:** Fixture tests for parse split and basic `{expr}` / `{#if}` / `{#each}`

---

### Task 4: `@avedon/server`

**Files:**
- Create: `packages/server/src/types.ts`, `match.ts`, `pipeline.ts`, `errors.ts`, `ssr.ts`, `index.ts`
- Test: `packages/server/src/match.test.ts`, `pipeline.test.ts`

**Produces:** `Routes`, `matchRoute`, `createHandler`, `HttpError`, `renderPage`

- [ ] **Step 1:** Path matching (`:param`, `*`)
- [ ] **Step 2:** Pipeline: hooks → match → guards → api | action | page
- [ ] **Step 3:** SSR HTML via component `render(data)` + `app.html` shell
- [ ] **Step 4:** Tests for match + api + load

---

### Task 5: `@avedon/vite-plugin` + `@avedon/adapter-node` + CLI

**Files:**
- Create: `packages/vite-plugin/src/index.ts`
- Create: `packages/adapter-node/src/index.ts`, `files/server.js` template
- Create: `packages/cli/src/cli.ts`, `commands/*`

- [ ] **Step 1:** Vite plugin: transform `.ave` → client; virtual `?server` for server module
- [ ] **Step 2:** Dev middleware: SSR via `createHandler`
- [ ] **Step 3:** `adapt(builder)` writes `build/server.js` + copies client assets
- [ ] **Step 4:** CLI: `dev`, `build`, `preview`, `create`

---

### Task 6: `examples/basic` + docs + tests

**Files:**
- Create: `examples/basic/**`, `docs/guide.md`, Playwright config + smoke test

- [ ] **Step 1:** Example with Home (ssr), About (ssg), App (csr), API + form action
- [ ] **Step 2:** Compiler + server unit tests green
- [ ] **Step 3:** Playwright smoke: home renders, API returns JSON
- [ ] **Step 4:** Write `docs/guide.md`; update `memories.md` status

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `.ave` format | 3 |
| routes.ts hybrid | 4, 6 |
| load/actions/api | 3, 4 |
| Vite | 5 |
| adapter-node | 5 |
| CLI | 5 |
| TS + example + tests | 1, 2, 6 |
