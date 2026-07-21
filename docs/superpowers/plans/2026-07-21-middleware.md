# Middleware Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a route-agnostic middleware layer (logging, CORS, rate-limit) separate from guards, without breaking existing `hooks.handle`.

**Architecture:** Onion/`resolve` wrapping. `Middleware` shares the shape of today's `HandleHook`. `sequence(...handlers)` composes outer→inner. `hooks.middleware` is primary; optional `handle` runs after the array (`sequence(...middleware, handle)`). Guards stay match-after; middleware never sees `params`.

**Tech Stack:** TypeScript, `@vexjs/server`, Vitest, existing Vite hooks loader.

## Global Constraints

- Keep `handle`; add `middleware?: Middleware[]` + `sequence()`
- Built-ins: `cors()`, `logger()`, `rateLimit()` (process-local Map; docs warn single-instance)
- No `locals` this round
- Commit only if maintainer asks
- Spec: `docs/superpowers/specs/2026-07-21-middleware-design.md`

---

### Task 0: Spec + plan on disk

- [x] Write design spec
- [x] Save this plan under `docs/superpowers/plans/`

### Task 1: `sequence` (TDD)

**Files:**
- Create: `packages/server/src/sequence.ts`
- Create: `packages/server/src/sequence.test.ts`
- Modify: `packages/server/src/types.ts`, `packages/server/src/index.ts`

- [ ] Failing tests: order outer→inner; early Response skips inner; post-`resolve` header mutate
- [ ] Implement `sequence`; export `Middleware` (= `HandleHook`)

### Task 2: Wire into `createHandler`

**Files:**
- Modify: `packages/server/src/pipeline.ts`, `packages/server/src/types.ts`
- Modify: `packages/server/src/pipeline.test.ts`

- [ ] `hooks.middleware` + compose with `handle`
- [ ] Tests: middleware before match; short-circuit; handle-only still works

### Task 3: Built-ins (TDD)

**Files:**
- Create: `packages/server/src/middleware.ts`
- Create: `packages/server/src/middleware.test.ts`

- [ ] `logger`, `cors`, `rateLimit` with unit tests

### Task 4: Example, scaffold, docs

- [ ] `examples/basic-app` + create-vex-app template hooks
- [ ] `docs/middleware.md`, index links, package README, `memories.md`

### Task 5: Verify

- [ ] `pnpm -F @vexjs/server test` and broader suite as needed
