# Claim hydrate (DOM reuse)

Updated: 2026-07-31
**Status:** Approved for implementation (2026-07-31)
**Plan:** `docs/superpowers/plans/2026-07-31-claim-hydrate.md`

## Goal

Replace soft remount hydration with **strict DOM claim**: reuse the SSR/SSG nodes already in the document, attach listeners/effects/component instances to them, and keep live node identity (focus, media, iframes, third-party embeds) without snapshot/restore on the happy path.

Primary win is **correctness** (identity), not partial morph or progressive hydration.

## Current behavior (baseline)

`hydrate(target, props)` in compiled client output:

1. Captures focus / form / open / scroll from the SSR tree
2. `mount`s into a detached holder
3. `replaceChildren` into `target`
4. Restores captured state

Docs (`docs/rendering.md`) call this soft hydrate and note true DOM reuse as post-v1. Child components always `.mount()` even during hydrate.

## Non-goals (v1)

- Partial morph / best-effort subtree remount when only some nodes mismatch
- Progressive / idle / island hydration
- Adopting DOM IDL into signals (bound controls: **signals win**)
- Changing client navigation’s HTML swap (`moveChildNodes`); nav still fetches HTML then hydrates the new tree
- On-demand ISR, CF ISR, or `.ave` LSP

## Locked decisions

| Topic | Choice |
|-------|--------|
| Primary goal | Correctness — keep live SSR nodes |
| Mismatch policy | Strict claim only: **throw in `dev`**, **soft-remount in prod** (today’s holder + restore) |
| Scope | Full tree: elements, text, `{#if}` / `{#each}` / `{#key}` / `{#await}`, snippets, child components |
| Bound values | **Signals win** — effects apply prop/signal state onto claimed nodes after claim |
| Implementation | **Mode flag** — one client emitter parameterized by `create` \| `claim` (not dual full emit, not morphdom) |
| Empty / CSR | No children or `[data-avedon-csr]` → `create` mount (unchanged) |
| Soft remount | Kept only as mismatch / empty / CSR fallback |

## Architecture

### Overview

`hydrate(target, props)` runs the same client mount body in **claim mode** against existing `target` children. Runtime helpers advance a sibling cursor instead of `createElement` / `appendChild`. On any structural mismatch, claim aborts for that root: throw when `dev`, else soft-remount.

```
SSR/SSG HTML in #app
        │
        ▼
 hydrate(target, props)
        │
        ├─ empty / data-avedon-csr? ──► mount(create)
        │
        ├─ claim walk (mode=claim)
        │     ├─ OK ──► effects/binds/listeners on claimed nodes
        │     └─ mismatch ──► dev: throw | prod: soft remount + restore
        │
        └─ return { destroy, update } (same shape as mount)
```

### Compiler

- Parameterize `emitClientNodes` / element / block / component emit with mode (`create` | `claim`), or a small set of codegen macros that expand differently per mode.
- Generated `hydrate()`:
  - Early exit to `mount` for empty / CSR
  - Enter claim mode and run the shared body
  - Catch / check mismatch sentinel → soft remount path (reuse existing capture/restore helpers)
- Generated `mount()` remains create mode only.
- Child UI components: emit `Child.hydrate(...)` in claim mode instead of `Child.mount(...)` into a fresh parent append.

### Runtime (`@avedon/runtime`)

Claim helpers (names illustrative):

| Helper | Role |
|--------|------|
| `claimElement(parent, tag)` | Next significant child must be `Element` with matching tag (SVG NS aware) |
| `claimText(parent, expected?)` | Next text node; optional equality check when static |
| `claimComment(parent, data)` | Block anchor (`if`, `each`, `each-keyed`, `key`, `await`, …) |
| `hydrateMismatch(message)` | Dev: throw; prod: signal failure for outer soft remount |
| Soft remount | Existing `capture*` / `restore*` + holder `mount` + `replaceChildren` |

Whitespace policy: skip only whitespace-only text nodes that SSR also omits/normalizes under one documented rule; any unexpected node → mismatch (fail closed).

### SSR / stream anchor parity

Client blocks already insert comment anchors (`createComment('if')`, etc.). SSR/stream today emit only the active branch HTML — **no anchors**.

v1 requires SSR and streaming emit the **same** comment markers the client claims, immediately before block content, so the claim cursor can locate branches.

| Block | SSR emits | Claim |
|-------|-----------|--------|
| `{#if}` | `<!--if-->` then active branch | Claim comment, then branch children into `__nodes` |
| `{#each}` (unkeyed) | `<!--each-->` then N item bodies | Claim comment, positional items |
| `{#each}` (keyed) | `<!--each-keyed-->` then items in render order | Claim comment; build records by key as rendered |
| `{#key}` | `<!--key-->` then body | Claim comment + body |
| `{#await}` | `<!--await-->` then pending or settled branch as HTML currently does | Claim comment + present branch; later settlement uses existing client update path |

`{#key}` remains client-remount semantics after hydrate; first paint claims the SSR body once.

### Components

- `hydrate(targetOrParent, props)` claims the component’s root nodes from the parent cursor (multi-root / fragment-shaped output must consume the same number/shape of nodes `render()` produced).
- Nested components recurse in claim mode.
- `destroy` / `update` APIs unchanged.

### `{@html}`

Treat as an opaque island: claim a dedicated marker or a single container whose `innerHTML` is trusted content. Do not deep-walk arbitrary HTML. Structure that cannot be claimed → mismatch.

**v1 implementation note:** `{@html}` and **slotted child components** throw `HydrateMismatchError` during claim so production soft-remounts (slots need a follow-up to claim inlined SSR slot HTML).

### Signals win

After a successful claim, existing `__effects` and bind wiring run as on mount and write attrs/IDL from current signals/props. Early user input between paint and hydrate may be overwritten — documented honestly.

## Error handling

1. One mismatch aborts the **entire** claim for that hydrate root (no partial morph).
2. **Dev** (`dev: true` / Vite `import.meta.env.DEV` — align with existing client entry): throw with tag/path hint.
3. **Prod**: fall back to soft remount + restore (focus/form/open/scroll) so production stays resilient to rare skew.
4. Soft remount failure modes unchanged from today.

## Testing

- **Unit (runtime):** claim helpers; whitespace skip; mismatch throw vs fallback flag.
- **Unit (compiler):** SSR/stream output includes anchors; client hydrate code references claim helpers; node identity assertions where jsdom allows.
- **Playwright labs:**
  - Same input element remains focused across hydrate (identity)
  - `<video>` / `<iframe>` (or lab stub) same node after hydrate
  - Bound values reflect signals after claim
  - Forced mismatch lab: prod path remounts (or documented test hook)

## Docs

- Update `docs/rendering.md` — claim hydrate as default; soft remount as fallback only.
- Note signals-overwrite-early-input.
- Touch `docs/components.md` if child hydrate vs mount is user-visible.

## Packages / changeset

| Package | Likely bump | Why |
|---------|-------------|-----|
| `@avedon/runtime` | minor | Claim helpers + hydrate mismatch |
| `@avedon/compiler` | minor | Mode-aware client emit; `hydrate` rewrite |
| `@avedon/server` | patch if any | Only if shared HTML helpers move; usually compiler owns SSR strings |
| Docs / e2e | with above | |

## Success criteria

1. Happy-path hydrate does not call `replaceChildren` on `#app` / page target solely to swap a remounted tree.
2. Claimed element nodes are `===` to pre-hydrate SSR nodes in tests.
3. Mismatch: throws in dev; soft-remounts in prod.
4. Existing unit + smoke + Playwright stay green; new labs cover identity + mismatch.
5. Docs no longer describe soft remount as the primary hydrate strategy.

## Open implementation notes (non-blocking)

- Exact soft-remount trigger API (throw subclass vs return sentinel) left to the plan.
- Whether layout shell vs `[data-avedon-page]` is a separate claim root stays as today’s entrypoint behavior unless plan finds a bug.
- Streaming `{#await}` late injection must leave a claimable tree by the time the client entry runs (already true for settled payload; pending-only pages claim pending branch).
