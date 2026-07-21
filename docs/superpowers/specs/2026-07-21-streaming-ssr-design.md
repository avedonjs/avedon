# Streaming SSR (out-of-order)

Updated: 2026-07-21

## Goal

Replace blocking string SSR with **out-of-order streaming**: flush document shell and sync HTML early; `{#await}` emits placeholders immediately and streams resolved HTML later via injection payloads. Improve TTFB on large/slow pages.

## Non-goals

- Changing `ssg` / `csr` semantics (SSG buffers a complete HTML string at build time)
- New `{#suspense}` block (v1 uses `{#await}` only)
- Cloudflare/Bun adapter stream plumbing beyond Web `Response` body
- Progressive hydration (suffix + client entry still wait for all boundaries)

## Dual render API

SSR modules export:

- `render(props): string` — sync expression path (back-compat; `{#await}` stays empty)
- `renderInto(ctrl, props): Promise<void>` — writes into a shared `RenderStreamController`
- `renderToStream(props): ReadableStream<Uint8Array>` — owned controller; waits pending then closes

## Out-of-order format

1. Placeholder: `<div hidden id="avedon-b-{id}"></div>`
2. Later chunk: JSON payload script `#avedon-r-{id}` + `script[data-avedon-stream]` that replaces the placeholder
3. IDs monotonic per request controller (`b1`, `b2`, …)

Client navigations use `DOMParser` (scripts do not run) → `settleAvedonStream(root)` applies pending payloads.

## Pipeline

1. `load` / guards as today
2. Shell prefix flushed first
3. Leaf + layouts via `renderInto` / function `children`
4. `waitPending()` then shell suffix (`__AVEDON_DATA__`, client entry)

## Adapters

Node adapter and Vite middleware pipe `response.body` — no `arrayBuffer()` buffer for HTML.
