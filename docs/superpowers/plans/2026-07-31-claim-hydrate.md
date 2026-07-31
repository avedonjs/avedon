# Claim Hydrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace soft-remount `hydrate()` with strict DOM claim (reuse SSR nodes), keeping soft remount only as empty/CSR/mismatch fallback.

**Architecture:** One client emitter parameterized by `create` | `claim`. Runtime cursor helpers (`claimElement` / `claimText` / `claimComment`) advance over existing siblings. SSR/stream emit matching `<!--if-->` etc. anchors. Mismatch: throw in `dev`, soft-remount in prod. Signals win after claim.

**Tech Stack:** TypeScript, Vitest, Playwright, existing `@avedon/compiler` + `@avedon/runtime`

**Spec:** `docs/superpowers/specs/2026-07-31-claim-hydrate-design.md`

## Global Constraints

- Stay on `main`; commit only when the maintainer explicitly asks
- TypeScript 5.x only
- English-only docs / changeset
- No partial morph — one mismatch aborts the whole claim root
- Bound values: signals win (effects write after claim)
- Soft remount + capture/restore remains the prod mismatch / empty / CSR path

---

## File map

| Path | Responsibility |
|------|----------------|
| `packages/runtime/src/claim.ts` | Cursor claim helpers + `HydrateMismatchError` + `isDevHydrate` |
| `packages/runtime/src/claim.test.ts` | Unit tests for claim helpers |
| `packages/runtime/src/index.ts` | Re-export claim API |
| `packages/runtime/src/document.ts` | Soft remount helpers unchanged (still used by fallback) |
| `packages/compiler/src/codegen.ts` | SSR anchors; client emit mode create/claim |
| `packages/compiler/src/compile.ts` | `hydrate()` claim-first + soft fallback; imports |
| `packages/compiler/src/compile.test.ts` | Anchor + claim codegen fixtures |
| `docs/rendering.md` | Claim hydrate docs |
| `docs/components.md` | Child hydrate note if needed |
| `examples/basic-app/...` | Optional Playwright labs for identity |
| `e2e/...` | Playwright identity / mismatch labs |
| `.changeset/claim-hydrate.md` | runtime + compiler minor |

---

### Task 1: Runtime claim helpers

**Files:**
- Create: `packages/runtime/src/claim.ts`
- Create: `packages/runtime/src/claim.test.ts`
- Modify: `packages/runtime/src/index.ts` (re-exports)

**Interfaces:**
- Produces:
  - `export class HydrateMismatchError extends Error`
  - `export type ClaimCursor = { parent: ParentNode; index: number }`
  - `export function createClaimCursor(parent: ParentNode): ClaimCursor`
  - `export function skipWhitespace(cursor: ClaimCursor): void`
  - `export function claimElement(cursor: ClaimCursor, tag: string): Element`
  - `export function claimText(cursor: ClaimCursor, expected?: string): Text`
  - `export function claimComment(cursor: ClaimCursor, data: string): Comment`
  - `export function assertClaimExhausted(cursor: ClaimCursor): void`
  - `export function hydrateMismatch(message: string, dev: boolean): never | void` — throws `HydrateMismatchError` when `dev`; when `!dev` throws same error (caller catches for soft remount) **OR** use: always throw `HydrateMismatchError`, outer hydrate catches and soft-remounts only when `!dev`

**Locked:** Always throw `HydrateMismatchError` from claim helpers. Generated `hydrate()` wraps claim in `try/catch`: if `HydrateMismatchError` and `!import.meta.env.DEV`, soft-remount; if `DEV`, rethrow.

- [ ] **Step 1: Write failing tests** in `packages/runtime/src/claim.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  assertClaimExhausted,
  claimComment,
  claimElement,
  claimText,
  createClaimCursor,
  HydrateMismatchError,
  skipWhitespace,
} from './claim.js'

function parentOf(...nodes: Node[]): ParentNode {
  const d = document.createElement('div')
  for (const n of nodes) d.appendChild(n)
  return d
}

describe('claim helpers', () => {
  it('claims matching element and advances', () => {
    const el = document.createElement('span')
    const c = createClaimCursor(parentOf(el))
    expect(claimElement(c, 'span')).toBe(el)
    assertClaimExhausted(c)
  })

  it('skips whitespace text before claim', () => {
    const el = document.createElement('b')
    const c = createClaimCursor(parentOf(document.createTextNode('  \n'), el))
    skipWhitespace(c)
    expect(claimElement(c, 'b')).toBe(el)
  })

  it('throws HydrateMismatchError on tag mismatch', () => {
    const c = createClaimCursor(parentOf(document.createElement('div')))
    expect(() => claimElement(c, 'span')).toThrow(HydrateMismatchError)
  })

  it('claims comment by data', () => {
    const com = document.createComment('if')
    const c = createClaimCursor(parentOf(com))
    expect(claimComment(c, 'if')).toBe(com)
  })

  it('claims static text when expected matches', () => {
    const t = document.createTextNode('hi')
    const c = createClaimCursor(parentOf(t))
    expect(claimText(c, 'hi')).toBe(t)
  })

  it('throws when expected text differs', () => {
    const c = createClaimCursor(parentOf(document.createTextNode('a')))
    expect(() => claimText(c, 'b')).toThrow(HydrateMismatchError)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm -F @avedon/runtime exec vitest run src/claim.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `packages/runtime/src/claim.ts`**

```ts
export class HydrateMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HydrateMismatchError'
  }
}

export type ClaimCursor = { parent: ParentNode; index: number }

export function createClaimCursor(parent: ParentNode): ClaimCursor {
  return { parent, index: 0 }
}

function childAt(cursor: ClaimCursor): ChildNode | null {
  return cursor.parent.childNodes[cursor.index] ?? null
}

export function skipWhitespace(cursor: ClaimCursor): void {
  while (true) {
    const n = childAt(cursor)
    if (!n || n.nodeType !== 3) return
    if ((n as Text).data.trim() !== '') return
    cursor.index++
  }
}

function advance(cursor: ClaimCursor): ChildNode {
  skipWhitespace(cursor)
  const n = childAt(cursor)
  if (!n) throw new HydrateMismatchError('unexpected end of children')
  cursor.index++
  return n
}

export function claimElement(cursor: ClaimCursor, tag: string): Element {
  const n = advance(cursor)
  if (n.nodeType !== 1) {
    throw new HydrateMismatchError(`expected <${tag}>, got nodeType ${n.nodeType}`)
  }
  const el = n as Element
  if (el.tagName.toLowerCase() !== tag.toLowerCase()) {
    throw new HydrateMismatchError(`expected <${tag}>, got <${el.tagName.toLowerCase()}>`)
  }
  return el
}

export function claimText(cursor: ClaimCursor, expected?: string): Text {
  // Do not skipWhitespace before text claims — caller decides
  const n = childAt(cursor)
  if (!n || n.nodeType !== 3) {
    throw new HydrateMismatchError('expected text node')
  }
  cursor.index++
  const t = n as Text
  if (expected != null && t.data !== expected) {
    throw new HydrateMismatchError(`expected text ${JSON.stringify(expected)}, got ${JSON.stringify(t.data)}`)
  }
  return t
}

export function claimComment(cursor: ClaimCursor, data: string): Comment {
  const n = advance(cursor)
  if (n.nodeType !== 8) {
    throw new HydrateMismatchError(`expected comment ${JSON.stringify(data)}`)
  }
  const c = n as Comment
  if (c.data !== data) {
    throw new HydrateMismatchError(`expected comment ${JSON.stringify(data)}, got ${JSON.stringify(c.data)}`)
  }
  return c
}

export function assertClaimExhausted(cursor: ClaimCursor): void {
  skipWhitespace(cursor)
  if (childAt(cursor)) {
    throw new HydrateMismatchError('unexpected trailing nodes after claim')
  }
}
```

- [ ] **Step 4: Export from `packages/runtime/src/index.ts`**

Add exports next to document exports:

```ts
export {
  HydrateMismatchError,
  createClaimCursor,
  skipWhitespace,
  claimElement,
  claimText,
  claimComment,
  assertClaimExhausted,
} from './claim.js'
export type { ClaimCursor } from './claim.js'
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `pnpm -F @avedon/runtime exec vitest run src/claim.test.ts`
Expected: PASS

- [ ] **Step 6: Commit only if maintainer asks** (skip by default)

---

### Task 2: SSR / stream comment anchors

**Files:**
- Modify: `packages/compiler/src/codegen.ts` (`emitSsr`, `emitSsrStream` for if/each/key/await)
- Modify: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: existing `emitSsr` / `emitSsrStream`
- Produces: HTML/stream that prefixes block content with `<!--if-->`, `<!--each-->`, `<!--each-keyed-->`, `<!--key-->`, `<!--await-->` (comment data must match client `createComment('…')` data)

- [ ] **Step 1: Write failing compiler tests**

```ts
it('SSR emits if comment anchor before branch', () => {
  const out = compile(
    `<template>{#if on}<span>y</span>{/if}</template>`,
    { filename: 'T.ave', generate: 'ssr' },
  )
  expect(out.code).toContain('<!--if-->')
})

it('SSR emits each / each-keyed / key / await anchors', () => {
  // one compact source or separate its — assert <!--each-->, <!--each-keyed-->, <!--key-->, <!--await-->
})
```

- [ ] **Step 2: Run — expect FAIL** (anchors absent)

- [ ] **Step 3: Patch `emitSsr` / `emitSsrStream`**

For `if`:
```ts
parts.push(`('<!--if-->' + ((${sigExpr(t.cond)}) ? (${thenExpr}) : (${elseExpr})))`)
```

For unkeyed each: prefix `'<!--each-->' + …`
For keyed each: prefix `'<!--each-keyed-->' + …`
For key: prefix `'<!--key-->' + …`
For await sync: prefix `'<!--await-->' + …`
Stream variants: `__enqueue('<!--if-->');` before branch body (same for others).

- [ ] **Step 4: Run compile tests — PASS**

- [ ] **Step 5: Run related SSR unit/smoke if any break from extra comments — fix consumers that assert exact HTML strings**

Run: `pnpm -F @avedon/compiler test` and fix golden HTML expectations that break.

---

### Task 3: Mode-aware client emit (elements + text + expr)

**Files:**
- Modify: `packages/compiler/src/codegen.ts` — `emitClientNodes`, `emitClientElement`, mount body entry
- Modify: `packages/compiler/src/compile.ts` — hydrate claim path skeleton importing claim helpers

**Interfaces:**
- Consumes: Task 1 claim API
- Produces: when `__claim` truthy at runtime in hydrate body:
  - elements: `const el = __claimElement(__cursor, 'div')` instead of create+append
  - static text: `__claimText(__cursor, '…')`
  - dynamic expr text: `__claimText(__cursor)` then effect sets `.data`

**Approach:** Thread `mode: 'create' | 'claim'` through emit functions. Claim mode emits against a local `__cursor` created from `target` at start of shared body. Prefer generating **both** paths once via helpers like:

```ts
function emitCreateOrClaimElement(tag, id, parent, mode): string {
  if (mode === 'claim') {
    return `const ${id} = __claimElement(__cursor, ${jsLiteral(tag)});`
  }
  return `const ${id} = ${createElExpr(tag)}; ${parent}.appendChild(${id});`
}
```

For claim mode, **do not** append — node already under parent. Child recursion: create nested cursor `createClaimCursor(el)` for element children.

- [ ] **Step 1: Failing test** — compiled client `hydrate` contains `__claimElement` / `__createClaimCursor`

- [ ] **Step 2: Implement mode plumbing + element/text claim emit**

- [ ] **Step 3: Rewrite `hydrate` in `compile.ts`:**

```js
export function hydrate(target, __props = {}) {
  if (!target.hasChildNodes() || target.querySelector('[data-avedon-csr]')) {
    target.textContent = '';
    return mount(target, __props);
  }
  try {
    return __mountClaim(target, __props); // shared body with mode claim
  } catch (e) {
    if (!(e instanceof __HydrateMismatchError) || import.meta.env.DEV) throw e;
    // soft remount (existing capture/restore path)
    ...
  }
}
```

Prefer extracting shared mount internals so `mount` = create and claim path shares lifecycle/effects. Practical v1: generate `mount` as today; generate `__mountClaim` as claim-mode duplicate of mount body **only if** full mode-thread is too large — **prefer single `mountInternal(target, props, claim)`** codegen.

- [ ] **Step 4: Unit test** jsdom: compile a trivial `<template><p>hi</p></template>`, SSR render into div, hydrate, assert `p` node identity preserved.

- [ ] **Step 5: `pnpm -F @avedon/compiler test` PASS**

---

### Task 4: Claim emit for blocks + components + snippets

**Files:**
- Modify: `packages/compiler/src/codegen.ts` — if/each/key/await/component branches for claim mode

**Rules:**
- Claim: `__claimComment(__cursor, 'if')` then claim branch children with nested cursor or same-parent cursor after comment (siblings after the comment until… **problem:** without end markers, claim must know exact child count from the branch template).
- **End strategy:** For claim of a block branch, walk exactly the nodes the branch template would create (same emit as create, but claim). Sibling cursor continues after those nodes. No end comment required.
- Each item: for each list item at hydrate time, claim that item’s body nodes (list length from props/data must match DOM or mismatch).
- Components: `Comp.hydrate` with claim cursor into parent — implement as `hydrate(parent, props)` that creates cursor on `parent` at **current index** — pass cursor by mutating shared parent cursor from outer emit.

**Component claim API (locked for plan):**

```ts
// generated
export function hydrate(target, __props = {}) {
  // target is parent; claims next siblings into place — OR
}
```

Simpler locked approach matching Svelte: components receive the **parent element** and claim their roots as next children of that parent (same as mount append position). Outer emitter in claim mode does **not** create a wrapper; calls `Child.hydrate(parent, props)` which uses/advances a cursor stored on a stack:

Runtime:
```ts
let claimStack: ClaimCursor[] = []
export function claimPush(parent: ParentNode) { ... }
export function claimPop() { ... }
export function claimCurrent(): ClaimCursor
```

Outer hydrate: `claimPush(target)`; mount body uses `claimCurrent()`; child component hydrate: claims into same cursor (roots are siblings). Nested element children: `claimPush(el)` before children, `claimPop()` after.

- [ ] **Step 1: Add claim stack helpers + tests**

- [ ] **Step 2: Wire block/component claim emit**

- [ ] **Step 3: Compiler + runtime tests for if/each/component identity**

- [ ] **Step 4: Full `pnpm -F @avedon/compiler test && pnpm -F @avedon/runtime test`**

---

### Task 5: Docs, labs, changeset

**Files:**
- Modify: `docs/rendering.md`
- Modify: `docs/components.md` (if needed)
- Create: `.changeset/claim-hydrate.md`
- Create: lab route + Playwright for node identity (focus or video)
- Update: `docs/superpowers/specs/2026-07-31-claim-hydrate-design.md` status → Approved; Plan link
- Update: `memories.md` status bullet

- [ ] **Step 1: Docs** — claim hydrate primary; soft remount fallback; signals win note

- [ ] **Step 2: Changeset**

```md
---
'@avedon/runtime': minor
'@avedon/compiler': minor
---

Claim hydrate: reuse SSR DOM nodes (strict claim); soft remount only on mismatch/CSR/empty.
```

- [ ] **Step 3: Playwright lab** — assert `input` node identity across hydrate (expose via `data-testid` + `page.evaluate`)

- [ ] **Step 4: `pnpm test && pnpm test:smoke` (and Playwright subset for new lab)

- [ ] **Step 5: Commit when maintainer asks**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Mode-flag emitter | 3–4 |
| Claim helpers | 1 (+ stack in 4) |
| SSR anchors | 2 |
| Full tree blocks/components | 4 |
| Dev throw / prod soft remount | 3 |
| Signals win | 3–4 (effects unchanged) |
| Docs + changeset | 5 |
| Identity tests | 3–5 |

## Execution note

Maintainer asked to go straight to implementation after plan. Prefer **inline execution** on `main`. Skip git commits unless asked.
