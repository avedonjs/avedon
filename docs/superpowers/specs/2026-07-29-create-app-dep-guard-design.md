# Create-app dependency guard

Updated: 2026-07-29  
**Status:** Implemented (2026-07-30)  
**Scope:** `create-avedon-app` template sync, pack smoke, compiler↔runtime contract

## Goal

Prevent scaffolded apps from installing `@avedon/*` versions that lack APIs the current compiler/CLI emit (e.g. `__contextBegin`), by keeping template ranges aligned with the monorepo and verifying pack → install → build in CI.

## Non-goals

- Smoke against the public npm registry for unpublished versions (false failures during pre-publish PRs)
- Multi-repo / separate version trains for create-app vs core packages
- Lockstep “fixed” Changesets group for all `@avedon/*` packages
- Auto-opening a changeset when sync mutates the template outside `changeset version`

## Problem

`create-avedon-app` ships hardcoded caret ranges in `template/package.json` and adapter constants. When `@avedon/compiler` starts emitting new `@avedon/runtime` imports, but the template still pins an older major/minor (e.g. `runtime@^0.1.0` → npm `0.1.2`), Vite fails at first `avedon dev`. Monorepo `create-smoke` uses `file:` links and does not catch this. `create-pack-smoke` scaffolds only — no install/build.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Sync source of truth | Workspace `packages/*/package.json` `version` fields |
| Range shape | `^X.Y.Z` from current workspace version |
| Sync entrypoint | `scripts/sync-create-app-deps.mjs` |
| CI drift gate | `node scripts/sync-create-app-deps.mjs --check` (exit 1 on diff) |
| Release hook | Run sync **after** `changeset version`; if template/adapter files changed, bump `create-avedon-app` patch version in the same Version Packages commit |
| Pack smoke | Extend `e2e/create-pack-smoke.mjs`: pack create-app + core deps → scaffold → rewrite app deps to local tarballs → `npm install` → `avedon build` |
| Peer dependency | `@avedon/compiler` declares `peerDependencies["@avedon/runtime"]` as `^` + runtime workspace version; same sync script updates it |
| Contract test | Compiler test: codegen import names for runtime helpers must exist on `@avedon/runtime` exports |

## Architecture

```
Workspace package versions
        │
        ▼
scripts/sync-create-app-deps.mjs
        ├── writes template/package.json @avedon/* + avedon ranges
        ├── writes apply-adapter.ts ADAPTER_*_RANGE constants
        ├── writes compiler peerDependencies["@avedon/runtime"]
        └── --check: compare expected vs on-disk (CI)

Release: pnpm changeset version
        → sync-create-app-deps.mjs
        → optional create-avedon-app patch bump if files changed

CI (E2E smoke / test:smoke):
        create-pack-smoke
          pack create-avedon-app, runtime, server, vite-plugin, cli,
               adapter-node, compiler (+ transitive as needed)
          scaffold isolated app (npm ranges from template)
          rewrite deps → file:tarballs for avedon packages
          npm install && npx avedon build

Unit:
        compiler contract test (emitted runtime imports ⊆ runtime exports)
```

### Sync targets

| File | Fields |
|------|--------|
| `packages/create-avedon-app/template/package.json` | `@avedon/adapter-node`, `@avedon/runtime`, `@avedon/server`, `@avedon/vite-plugin`, `avedon` |
| `packages/create-avedon-app/src/apply-adapter.ts` | `ADAPTER_EDGE_RANGE` from `adapter-cloudflare` / `adapter-bun` version (same caret; packages share version line today) |

Non-avedon deps (`typescript`, `vite`, `wrangler`, ORM) stay manual.

### Pack smoke rewrite

After scaffold, map each `@avedon/*` / `avedon` dependency in the app `package.json` to the corresponding packed `.tgz` path. Do **not** install those packages from the registry. This validates “what create-app will ship + current package code” together without depending on npm publish order.

### Peer + contract

- `peerDependencies` warns consumers when runtime is too old for the compiler they resolve.
- Contract test fails in unit CI if codegen adds an import the runtime does not export — earlier than pack smoke.

## Error handling

- Sync `--check` prints a short diff / expected ranges and tells the operator to run the script without `--check`.
- Pack smoke fails on non-zero `avedon build` (compile/import errors surface here).
- Sync after version: if `create-avedon-app` was not already bumped by Changesets but template files changed, script increments patch and leaves a one-line note in stdout (Changelog left to next human changeset or empty patch note is acceptable for Version Packages automation).

## Testing

| Layer | What |
|-------|------|
| Unit | Sync script dry-run / check against fixture or live workspace; compiler runtime-export contract |
| Smoke | Extended `create-pack-smoke` in `pnpm test:smoke` (already on E2E workflow) |
| Manual | After a fake runtime version bump, `--check` fails until sync |

## Out of scope follow-ups

- Verdaccio / publish-then-install matrix
- `avedon` meta-package that re-exports a locked set of peers for apps
