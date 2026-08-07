# `@avedon/adapter-static` design

Updated: 2026-08-07  
**Status:** Implemented (2026-07-30) — follow-ups: `404.html` / host `_redirects` presets, SPA fallback  
**Plan:** `docs/superpowers/plans/2026-07-30-adapter-static.md`  
**Scope:** Ship a fail-closed static export adapter so `avedon build` emits only `out/client/` (assets + SSG HTML), wire `create-avedon-app --adapter=static`, and dogfood on `apps/www`.

## Goal

Ship `@avedon/adapter-static` for fully static hosts (Cloudflare Pages, Netlify, GitHub Pages, S3/CDN, etc.). Apps must be **SSG-only**: no SSR, CSR, form actions, API handlers, or ISR. Build fails loudly when the route tree is incompatible.

## Non-goals (v1)

- SSR / CSR / actions / API / `revalidate` at runtime (hard fail instead)
- Fallback `404.html` or SPA-style `200.html` / catch-all shells
- Host-specific generators (`_redirects`, `netlify.toml`, `wrangler.toml` for Pages)
- Extracting shared `ssgHtmlPath` into `@avedon/shared` (optional follow-up; local helper OK)
- Changing Node / Bun / Cloudflare adapter runtime behavior beyond docs cross-links
- npm Trusted Publisher setup on the new package (document as release follow-up; same OIDC flow as other adapters)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Strategy | **Strict gate + thin adapt** — validate manifest in `adapt()`, then write client + SSG HTML only |
| Fail policy | Hard fail on `render !== 'ssg'`, any `actions` / `api` / `api_*`, or `revalidate` |
| CSR | Forbidden in v1 (same as SSR) |
| Output layout | Same as Node: `out/client/**` (default `out` = `build`) |
| Server artifacts | Do **not** write `server/`, `server.js`, or `worker.js` |
| create-app | `--adapter=static` (+ interactive choice) |
| www dogfood | Switch `apps/www` from `nodeAdapter` to `staticAdapter`; `pages:deploy` keeps `./build/client` |
| Empty SSG | If validation passes but `getSsgPages()` is empty → hard fail |

## Architecture

```
avedon build
  → Vite client (+ server bundle may still be produced by CLI; static adapt ignores it)
  → staticAdapter.adapt(builder)
       ├─ assertStaticCompatible(manifest)
       ├─ writeClient(out/client)
       └─ write SSG HTML under out/client   # / → index.html, /docs/x → docs/x/index.html
```

### Validation (`assertStaticCompatible`)

Walk `builder.getManifest().routes` (same shape other adapters already read):

1. Missing `render` or `render` in `{'ssr','csr'}` → throw with path + mode (default render is SSR).
2. Non-empty `actions`, `api`, or any `api_*` key → throw with path.
3. `revalidate` set (including `0` if present as a field meaning ISR config) → throw; static has no regenerator.
4. After writes: if `getSsgPages().length === 0` → throw (“no SSG pages emitted”).

Error messages should prefix `[@avedon/adapter-static]` and name the offending route path so scaffold/docs users can fix quickly.

### Adapter options

```ts
staticAdapter({
  out?: string  // default 'build'
})
```

### Path helper

Local `ssgHtmlPath(clientDir, routePath)` matching Cloudflare/Node rules: reject `\0`, `.`, `..`; `/` → `index.html`; `/a/b` → `a/b/index.html`.

### create-app

- Extend `AdapterChoice` with `'static'`.
- `applyAdapter`: swap `@avedon/adapter-node` for `@avedon/adapter-static` (workspace/`^` range via existing sync scripts), rewrite `avedon.config.ts` to `staticAdapter({ out: 'build' })`.
- Drop or replace `start` script — document “deploy the `build/client` folder”; no `avedon start` for static.
- Prompt + `--adapter=static` + create-smoke / scaffold tests.

Version range: follow create-app’s edge/new-adapter convention (caret of published major; workspace `file:` in monorepo pack smoke). First publish can start at `0.1.0` or align with sibling adapters — implementer picks consistent changeset minor/patch for the monorepo release train.

### www

- `avedon.config.ts`: `staticAdapter({ out: 'build' })`.
- `package.json`: depend on `@avedon/adapter-static` instead of `@avedon/adapter-node`.
- `pages:deploy` unchanged (`wrangler pages deploy ./build/client …`).
- Routes are already all `render: 'ssg'` — no route changes expected.

## File map (expected)

| Path | Role |
|------|------|
| `packages/adapter-static/package.json` | New package `@avedon/adapter-static` |
| `packages/adapter-static/src/index.ts` | `staticAdapter`, `assertStaticCompatible`, `ssgHtmlPath` |
| `packages/adapter-static/src/adapt.test.ts` | Unit: happy path + fail cases |
| `packages/adapter-static/README.md` | Usage + fail-closed rules |
| `packages/create-avedon-app/src/*` | `static` choice, `applyAdapter`, prompts, tests |
| `apps/www/*` | Switch adapter dependency + config |
| `docs/deployment.md` | Static section; update intro list |
| `docs/configuration.md` / `docs/cli.md` | Mention `staticAdapter` / `--adapter=static` |
| `e2e/static-adapt-smoke.mjs` | Build fixture + assert tree; optional fail fixture |
| Root `package.json` `test:smoke` | Append static smoke |
| Turborepo / workspace | Include new package (pnpm workspace globs already cover `packages/*`) |
| Changeset | New package + create-app + docs/www as needed |
| `memories.md` | Status when shipped |

## Testing

- **Unit:** mock `AdapterBuilder` — SSG-only manifest writes `client/` + HTML; each forbidden case throws; empty `getSsgPages` throws.
- **Smoke:** `e2e/static-adapt-smoke.mjs` — temporary app (or mutate fixture config) with `staticAdapter`, `avedon build`, assert `build/client/index.html` + assets exist and no `build/server.js` / `worker.js`.
- **Fail smoke (lightweight):** build with an SSR route using static adapter → non-zero exit / error string contains `@avedon/adapter-static`.
- **create-app:** `--adapter=static` scaffold assertions (config import + dependency).
- **www:** `pnpm -F www build` (or existing CI path) succeeds after switch.

## Success criteria

1. Stub-free `staticAdapter()` completes `adapt()` for an SSG-only app; output is under `out/client` only (plus empty parents as needed).
2. SSR, CSR, actions, API, and `revalidate` each produce a hard build failure with a clear route path.
3. `pnpm create avedon-app … --adapter=static` wires the package and config.
4. `apps/www` builds with `staticAdapter`; Pages deploy path still points at `build/client`.
5. `docs/deployment.md` documents Static as a first-class target (no “use node and upload client” workaround as the primary story).

## Follow-ups

- npm Trusted Publisher OIDC for `@avedon/adapter-static`
- Optional shared path helper in `@avedon/shared`
- Optional `fallback` / `404.html` for hosts that need SPA-style unknown paths (explicit non-goal for v1)
- Optional host presets (`_headers`, `_redirects`) once real user demand appears
