# `@avedon/adapter-cloudflare` (Workers) design

Updated: 2026-07-23  
**Status:** Approved for implementation (2026-07-23)  
**Plan:** `docs/superpowers/plans/2026-07-23-adapter-cloudflare.md`  
**Scope:** Implement the Cloudflare **Workers** adapter (replace the current stub) so `avedon build` produces a Wrangler-deployable Worker + static assets.

## Goal

Ship a production-capable `@avedon/adapter-cloudflare` that mirrors the Node adapter’s build contract: write client assets and SSG HTML, emit a Worker entry that runs `@avedon/server`’s `createHandler` on the edge, and generate Wrangler config so `wrangler deploy` works without hand-rolled glue.

## Non-goals (v1)

- Cloudflare **Pages** Functions / Pages-only deploy (www stays static Pages as today)
- **ISR** / `revalidate` on Workers (KV/R2 stale-while-revalidate)
- `@avedon/adapter-bun` implementation
- Switching the avedon toolchain to the Cloudflare Vite plugin
- Durable Objects, Queues, D1, Hyperdrive bindings (apps may add manually later)
- Automatic custom-domain / CI deploy for end-user apps
- Changing `createHandler` semantics for Cloudflare-specific request types

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Target | Cloudflare **Workers** (not Pages Functions) |
| Static files | Workers **Assets** with `ASSETS` binding |
| SSG | Emit HTML into the assets directory at build (same paths as Node `client/`) |
| ISR | Out of scope; `revalidate` does not regenerate on the edge in v1 |
| Build integration | Extend existing `adapt(builder)` (approach A — mirror Node) |
| Config format | Generate `wrangler.jsonc` in the adapter `out` directory |
| Compat | `nodejs_compat` + current `compatibility_date` at generation time |
| Session | Existing Web Crypto session; `SESSION_SECRET` via `wrangler secret` / dashboard |
| Routing | Platform **asset-first** default: matching static files (including SSG HTML and `/assets/*`) skip Worker; SSR/CSR shells, actions, APIs hit the Worker |

## Architecture

```
avedon build
  → Vite client + server bundles (unchanged)
  → cloudflareAdapter.adapt(builder)
       ├─ writeClient(out/client)          # JS/CSS/public + copied assets
       ├─ write SSG HTML under out/client  # /, /docs/… → **/index.html
       ├─ write out/worker.js              # fetch → createHandler(...)
       └─ write out/wrangler.jsonc         # main + assets.directory + nodejs_compat

wrangler deploy --config build/wrangler.jsonc
  → Worker script + uploaded assets (single unit)
```

### Request flow (runtime)

1. Request arrives at the Worker unit.
2. If path matches an uploaded asset (SSG `index.html`, hashed client JS, public files), Cloudflare serves it **without** invoking Worker code (default static-assets routing).
3. Otherwise the Worker `fetch` handler runs:
   - Build `createHandler({ routes, appHtml, hooks, error/notFound, clientEntry, session })` from the bundled server app (same options shape as Node).
   - Return the handler `Response` (streaming SSR supported — already Web-standard).
4. Optional: Worker may call `env.ASSETS.fetch(request)` for explicit asset fallback when useful; v1 can rely on platform asset-first and only run the handler for non-asset paths.

### Adapter options

```ts
cloudflareAdapter({
  out?: string      // default 'build' — output root containing client/ + worker.js + wrangler.jsonc
  name?: string     // Worker script name in wrangler.jsonc (default: package name or 'avedon-app')
})
```

### Generated `wrangler.jsonc` (shape)

- `name` — from options / package.json
- `main` — `./worker.js` (relative to config file)
- `compatibility_date` — date at generation (ISO calendar day)
- `compatibility_flags` — include `nodejs_compat`
- `assets.directory` — `./client`
- `assets.binding` — `ASSETS`

Apps may edit or replace this file after first generate; adapt() should overwrite on each build unless we later add a “merge” mode (not v1).

### Worker entry responsibilities

- Import server app module (routes, `appHtml`, hooks, error/notFound, session).
- Construct `createHandler` once at module scope when possible (cold start), or per-isolate as needed.
- `export default { async fetch(request, env, ctx) { … } }`.
- Map `SESSION_SECRET` (and any future secrets) from `env` into session config if the app exports a session factory pattern; **minimum v1:** document that apps should read `env.SESSION_SECRET` in `server-entry` compatible with Workers (no `process.env` without compat — with `nodejs_compat`, `process.env` may work when vars/secrets are bound; prefer documenting Wrangler `vars` / `secrets` explicitly).

**Session env note (locked for implementers):** Prefer injecting secrets via Wrangler secrets and reading them in a small Workers-safe way in the generated worker wrapper (e.g. pass `session: { secret: env.SESSION_SECRET }` when the app exports session options without a hardcoded secret). Exact merge with existing `server-entry.ts` `export const session` is an implementation detail; do not require Node `process.env` in docs as the only path.

### ISR / revalidate

- Build still emits SSG HTML for `render: 'ssg'` + `getStaticPaths`.
- If `revalidate` is set, v1 either ignores it at runtime (static forever until redeploy) or logs a one-time build warning — **no** background regeneration. Document the gap in `docs/deployment.md` / rendering notes.

## File map (expected)

| Path | Role |
|------|------|
| `packages/adapter-cloudflare/src/index.ts` | `cloudflareAdapter`, `adapt()`, worker source template, wrangler emitter |
| `packages/adapter-cloudflare/src/*.test.ts` | Unit tests for path layout / wrangler JSON / worker stub strings |
| `packages/adapter-cloudflare/README.md` | Usage: config, build, `wrangler deploy`, secrets |
| `docs/deployment.md` | Replace stub language with Workers guide |
| `docs/configuration.md` | Mention `cloudflareAdapter` alongside node |
| `examples/` or e2e | Thin verification: adapt output exists + wrangler config validates / dry-run if feasible |
| `memories.md` | Status when shipped |

## Testing

- Unit: given a mock `AdapterBuilder`, `adapt()` writes expected `client/` files, `worker.js` contains `createHandler`, `wrangler.jsonc` parses with `assets.binding === 'ASSETS'`.
- Integration (lightweight): build a fixture app (basic-app or minimal) with `cloudflareAdapter`, assert artifact tree; optional `wrangler deploy --dry-run` / `wrangler versions upload --dry-run` when wrangler is available in CI (skip or soft-fail if auth missing).
- Manual: deploy a sample to a Workers account once before announcing.

## Success criteria

1. Stub throws are gone; `cloudflareAdapter()` completes `adapt()` for a normal build.
2. `wrangler deploy` from adapter `out` succeeds for a maintainer-owned test Worker (documented).
3. SSR route returns streamed/HTML from the Worker; SSG route is served as static asset HTML; client JS loads from assets.
4. Docs no longer call the Cloudflare adapter a stub.
5. ISR explicitly documented as unsupported on Cloudflare in v1.

## Follow-ups

- ISR via KV/R2
- Pages Functions variant or unified “static export” helper
- `@avedon/adapter-bun`
- `create-avedon-app --adapter cloudflare` flag
- `run_worker_first` / advanced asset routing if middleware must see every request
