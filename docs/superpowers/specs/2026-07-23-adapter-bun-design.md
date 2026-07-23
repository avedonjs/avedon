# `@avedon/adapter-bun` design

Updated: 2026-07-23  
**Status:** Approved for implementation (2026-07-23)  
**Plan:** `docs/superpowers/plans/2026-07-23-adapter-bun.md`  
**Scope:** Implement the Bun adapter (replace the stub) so `avedon build` produces a `Bun.serve` entry with Node-parity static serving, SSG, and ISR (stale-while-revalidate).

## Goal

Ship a production-capable `@avedon/adapter-bun` that mirrors `@avedon/adapter-node`: write client assets and SSG HTML, emit a Bun HTTP server that serves static files safely, handles SSG/ISR on disk, and forwards everything else to `@avedon/server`’s `createHandler` using Web `Request`/`Response`.

## Non-goals (v1)

- Changing Cloudflare or Node adapters beyond shared docs cross-links
- Extracting a shared “adapter-http-core” package (optional follow-up if duplication hurts)
- `create-avedon-app --adapter bun` flag (follow-up)
- Windows-specific Bun quirks beyond what Node already handles
- Bun.plugin / compile-to-binary packaging
- Requiring Bun in CI for all jobs — smoke may skip runtime checks when `bun` is absent

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Strategy | **Mirror Node** with `Bun.serve` (approach A) |
| ISR | **Full parity** with Node SWR (`revalidate` + background regenerate + atomic write) |
| Static paths | Same guarantees as Node: `resolveUnderRoot` / reject traversal before serving |
| Server API | Bun’s native `fetch(request)` → return `Response` (no Node `IncomingMessage` bridge) |
| ISR implementation | Bun-local helpers in `@avedon/adapter-bun` (not calling Node’s `tryServeSsgIsr`, which is tied to `http.ServerResponse`) |
| Shared logic | Reuse `@avedon/server` primitives: `matchRoute`, `isStale`, `renderSsgPage`, `createPathLock` |
| Start command | Document `bun run build/server.js` (or `bun build/server.js`); `avedon start` may remain Node-oriented unless CLI detects Bun server — **v1:** document Bun start explicitly; do not require CLI changes unless trivial |
| Output layout | Same as Node: `out/client/**`, `out/server.js` importing Vite SSR entry via relative path |

## Architecture

```
avedon build + bunAdapter
  → writeClient(out/client)
  → write SSG HTML under out/client
  → write out/server.js  (Bun.serve)

bun build/server.js
  → GET/HEAD static file under client/ (path-safe)
  → else tryServeSsgIsrBun → Response | null
  → else createHandler(request) → Response
```

### Request flow

1. Parse URL; resolve static path with the same safety rules as `@avedon/adapter-node` (`resolveUnderRoot` / equivalent).
2. If a safe file exists and method is GET/HEAD → `Bun.file` / stream as `Response` (correct `content-type` when practical; HTML for SSG paths).
3. Else `tryServeSsgIsrBun`:
   - If on-disk SSG HTML exists for pathname:
     - If route has `revalidate` and file is stale → kick off background `renderSsgPage` + atomic write (do not block).
     - Return HTML `Response` immediately (SWR).
   - Return `null` if not an SSG file hit.
4. Else `createHandler({...})(request)` and return its `Response` (streaming SSR supported).

### Adapter options

```ts
bunAdapter({
  out?: string  // default 'build'
})
```

### Generated server responsibilities

- Import app from relative Vite SSR entry (same `pathToImport` pattern as Node).
- Construct `createHandler` with routes, appHtml, hooks, error/notFound, clientEntry, session.
- Listen on `PORT` (default 3000) via `Bun.serve({ port, fetch })`.
- Export nothing required for deploy beyond running the file with Bun.

### Code organization

| Module | Role |
|--------|------|
| `src/index.ts` | `bunAdapter`, `adapt()`, `bunServerSource()` |
| `src/safe-path.ts` | Copy or thin re-export of Node’s `resolveUnderRoot` / `ssgHtmlPathSafe` (prefer **copy** to avoid coupling adapter-bun → adapter-node; keep tests in sync) |
| `src/ssg-isr.ts` | `tryServeSsgIsrBun` returning `Response \| null`; `writeHtmlAtomic`; path lock via `createPathLock` |

Duplicating `safe-path.ts` is acceptable for v1; a later refactor may move it to `@avedon/shared` or a tiny `@avedon/adapter-utils` package.

## File map (expected)

| Path | Role |
|------|------|
| `packages/adapter-bun/src/index.ts` | Adapter implementation |
| `packages/adapter-bun/src/safe-path.ts` (+ tests) | Path traversal guards |
| `packages/adapter-bun/src/ssg-isr.ts` (+ tests) | Bun ISR/SWR |
| `packages/adapter-bun/package.json` | Depend on `@avedon/server`, `@avedon/shared`; vitest |
| `packages/adapter-bun/README.md` | Config, build, `bun` start, ISR note |
| `docs/deployment.md` | Replace Bun stub with real section |
| `docs/configuration.md` | `bunAdapter` example |
| `e2e/bun-adapt-smoke.mjs` | Build with bun adapter; assert artifact; optional `bun` runtime ping |
| `memories.md` | Status |

## Testing

- Unit: safe-path (same cases as Node); ISR returns stale HTML and schedules regen (mock `renderSsgPage` or use a temp file + fake clock / mtime).
- Unit: `adapt()` writes `client/`, SSG HTML, `server.js` containing `Bun.serve` and `createHandler`.
- Smoke: swap basic-app config to `bunAdapter`, `avedon build`, assert `build/server.js` + `build/client/index.html`; if `bun` is on PATH, hit `/` and `/posts/1` once; else skip runtime and still pass artifact checks.
- Do not require Cloudflare credentials or Bun in every CI image — document Bun as optional for runtime portion.

## Success criteria

1. Stub throws are gone.
2. `bunAdapter()` produce Node-like `build/` layout with a Bun server entry.
3. Static, SSG, ISR SWR, and SSR/actions work under Bun for the basic-app fixture (manual or smoke when Bun available).
4. Docs no longer call the Bun adapter a stub.
5. Path traversal remains rejected for static serving.

## Follow-ups

- `create-avedon-app --adapter bun`
- Shared `safe-path` / ISR core package
- `avedon start` auto-detect Bun vs Node server entry
- Binary compile (`bun build --compile`) experiments
