# Bug Fix Report - avedon

**Date:** 2026-07-22  
**Analyzer:** Cursor Auto (comprehensive repository analysis)  
**Repository:** `/home/anilo/Projeler/avedon`  
**Commit (pre-fix base):** `b0b067860db841e8abc02bc8c18ea5c1cda62319`  
**Branch policy:** fixes applied on `main` (no fix branches per project preference)

## Overview

| Metric | Value |
|--------|-------|
| Bugs found | 10 |
| Bugs fixed | 7 |
| Bugs deferred | 3 |
| Unit tests | 147 passed (28 files) |
| Dependency audit (`pnpm audit --prod`) | No known vulnerabilities |
| Packages analyzed | `@avedon/*`, `create-avedon-app`, `avedon` CLI, `examples/basic-app` |

## Stack map

- **Monorepo:** pnpm workspaces + Turborepo + TypeScript
- **Core:** compiler (`.ave`), runtime, server (SSR/SSG/ISR), vite-plugin, CLI, adapters (node/bun/cloudflare), create-avedon-app
- **CI:** GitHub Actions (`ci.yml`, `e2e.yml`, `release.yml`, `codeql.yml`)
- **Tests:** Vitest + Playwright + node smoke scripts

## Critical findings (fixed)

1. **BUG-001 (CRITICAL)** — Path traversal in Node adapter static serving  
2. **BUG-002 (HIGH)** — XSS via HTML `on*` attributes in compiled SSR/client  
3. **BUG-009 (HIGH)** — Unescaped `HttpError` body in fallback SSR error HTML  

## Fix summary by category

| Category | Found | Fixed | Deferred |
|----------|------:|------:|---------:|
| SECURITY | 4 | 3 | 1 |
| FUNCTIONAL | 3 | 3 | 0 |
| PERFORMANCE / CODE_QUALITY | 3 | 1 | 2 |

## Detailed fix table

| BUG-ID | File | Category | Severity | Description | Status | Test |
|--------|------|----------|----------|-------------|--------|------|
| BUG-001 | `packages/adapter-node/src/index.ts`, `safe-path.ts` | SECURITY | CRITICAL | Static `path.join(clientDir, pathname)` escaped root | Fixed | `safe-path.test.ts` |
| BUG-002 | `packages/compiler/src/codegen.ts` | SECURITY | HIGH | Dynamic/static `on*` attrs emitted as HTML handlers | Fixed | `compile.test.ts` |
| BUG-003 | `packages/compiler/src/codegen.ts` | FUNCTIONAL | MEDIUM | `{#each}`/`{#if}`/`{#await}` reversed multi-node order | Fixed | `compile.test.ts` |
| BUG-005 | `packages/compiler/src/parse.ts` | FUNCTIONAL | MEDIUM | CSS inside `@media` not scoped | Fixed | `compile.test.ts` |
| BUG-007 | `packages/vite-plugin/src/index.ts` | CODE_QUALITY | LOW | HMR source Map grew forever | Fixed | (watcher prune) |
| BUG-008 | `packages/create-avedon-app/src/index.ts` | SECURITY | LOW | Unquoted `cd ${name}` in next steps | Fixed | `scaffold.test.ts` |
| BUG-009 | `packages/server/src/pipeline.ts` | SECURITY | HIGH | Fallback error HTML used raw `err.body` | Fixed | existing pipeline suite |
| BUG-004 | `packages/compiler/src/codegen.ts` | PERFORMANCE | MEDIUM | Nested `{#if}`/`{#each}` effect callbacks leak | Fixed — `__blockEffects` scoped per block | `compile.test.ts` |
| BUG-006 | `packages/compiler/src/compile.ts` | PERFORMANCE | LOW | Quadratic `signal(...)` HMR rewrite regex | Fixed — linear paren scanner | `hmr-signal.test.ts` |
| BUG-010 | `packages/compiler/src/codegen.ts` | SECURITY | MEDIUM | Slot `children` HTML string is trusted (layout contract) | Publish-gate: threat model documented; client Node path + trusted-string contract (no sanitizer). | `compile.test.ts` |

## Remaining risk / next steps

1. **BUG-004:** Fixed — per-block `__blockEffects` + shadow `__effects` on replace.  
2. **BUG-010:** Publish-gate closed — documented trusted contract + client `Node`/`DocumentFragment` append; string `children` remains trusted HTML (see `docs/security.md`).  
3. **BUG-006:** Fixed — linear `signal(` argument scanner for HMR keys.  
4. Keep CodeQL required on PRs; re-run after shipping these fixes.  
5. Consider e2e coverage for adapter-node path traversal against a built `server.js`.

## Testing results

```bash
pnpm build   # packages rebuilt
pnpm test    # 147/147 passed
pnpm typecheck  # clean
pnpm audit --prod  # no known vulnerabilities
```

Smoke/e2e not re-run in this pass (unit + typecheck green). Recommend `pnpm test:smoke` before release.
