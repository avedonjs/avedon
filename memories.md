# memories.md

Updated: 2026-07-22

## Project

- **avedon**: TypeScript-first full-stack web framework
- Workspace: `/home/anilo/Projeler/avedon` (pnpm workspaces + Turborepo) — GitHub: `avedonjs/avedon` (public)
- Spec: `docs/superpowers/specs/2026-07-20-avedon-design.md`

## Brand / package names (2026-07-21)

- Monorepo root: `avedon`
- Scoped packages: `@avedon/*` (shared, compiler, runtime, server, vite-plugin, adapter-*)
- CLI: `avedon` (`packages/cli`, commands: `avedon dev|build|start|create`)
- Scaffold: `create-avedon-app` → `pnpm create avedon-app`
- Component extension: `.ave` (formerly `.vex`); types: `*.ave.d.ts`
- App config: `avedon.config.ts`; cache: `.avedon/`
- Runtime markers: `__AVEDON_DATA__`, `%avedon.head%`, `%avedon.body%`, `data-avedon-*`, HMR `avedon:update`

## Decisions

- UI: `.ave` (Svelte-like)
- Routing: `defineRoutes` + `route(path, config)`
- Reactivity: `@avedon/runtime`
- Toolchain: Vite + `@avedon/vite-plugin`

## Brand visuals

- Logo package: `logo/` (crop marks + monogram A; accent `#06B6D4`; B/C drafts under explorations)
- README: `<picture>` + `logo-horizontal-{light,dark}.png`; favicon/OG: `examples/basic-app/public/`
- Wordmark: lowercase `avedon`

## Preferences

- Stay on main; commit only when the user asks
- TypeScript: stay on 5.x for now; skip 6 bump — wait for **7.1** (stable programmatic API) before major TS upgrade (2026-07-22)

## Status

- **Rename (2026-07-21):** project and GitHub org `avedon` / `avedonjs`; old `vexjs` name unused in the codebase
- DoD: `pnpm build`, `pnpm test`, `pnpm test:smoke` passed (after 2026-07-21 rename)
- **Audit pass (2026-07-21):** create monorepo `file:` link + `e2e/create-smoke.mjs`; CSRF Origin/Referer docs; streaming TTFB unit test; `e2e/isr-smoke.mjs`; basic-app login + `requireSession`; action redirect + Set-Cookie fix; `getSession` export
- **Streaming SSR default (2026-07-21):** `earlyShell` removed; SSR streams by default + ~40ms shell delay; post-shell redirect → `window.location` script; `bufferHtml` opt-out; `/login` bufferHtml; `e2e/stream-redirect-smoke.mjs`
- **GitHub Actions (2026-07-21):** `ci.yml`, `e2e.yml`, `release.yml`, `codeql.yml`; Changesets (`@changesets/cli`); CI/E2E/CodeQL green; Release awaits `NPM_TOKEN` (ENEEDAUTH expected); smoke orphan process-tree kill fix; branch protection guidance in CONTRIBUTING.md
- **CodeQL alerts (2026-07-21):** 12→0→3→1; final XSS (`js/xss-through-dom`) fixed via OOO payload JSON→`<template>` clone (`settleAvedonStream` no longer does text→innerHTML)
- **Docs language (2026-07-21):** repo docs English-only; `logo/README.md` translated from Turkish
- **Starter home (2026-07-21):** dark-stage template + basic-app home (Syne, `#09090B`, `#06B6D4`, live `signal` demo); spec `docs/superpowers/specs/2026-07-21-starter-home-design.md`
- **Create-app add-ons (2026-07-21):** implemented — optional Tailwind (style convert) + ORM wiring (Drizzle/Prisma/none, no schema); interactive + flags; spec `docs/superpowers/specs/2026-07-21-create-app-addons-design.md`; plan `docs/superpowers/plans/2026-07-21-create-app-addons.md`
- **Security audit (2026-07-22):** comprehensive pass — fixed path traversal, `on*` XSS, HttpError escape, `{#each}` order, `@media` CSS, scaffold quoting, HMR prune; BUG-010 trusted children + Node slots; BUG-004 block effects; BUG-006 HMR signal scan. Artefacts: `docs/superpowers/audits/2026-07-22/`.
- **npm (2026-07-22):** **0.1.1 published** — unscoped `avedon` / `create-avedon-app` on personal account, `@avedon/*` on org (accepted). Trusted Publisher OIDC still optional follow-up.
- **Fix round (2026-07-22):** committed as `babdfa0` (path traversal, pack smoke, audit remediations). Audit artefacts relocated under `docs/superpowers/audits/2026-07-22/`.
- **Pre-publish gate plan:** `docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md`
- **Branch protection (2026-07-22):** `main` requires Install, Typecheck, Build, Test, Smoke tests, `Analyze (javascript-typescript)` on PR merges; direct pushes allowed (`enforce_admins` false).
- **npm (2026-07-22):** **0.1.1 published** — all packages on registry (`avedon`, `create-avedon-app`, `@avedon/*`). First publish was manual OTP. Next: Trusted Publisher (OIDC) per package → `release.yml` (`docs/publishing.md`); then optional remove `NPM_TOKEN`.

## Next steps (priority, 2026-07-22)

Plan: `docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md`

1. Housekeeping — done
2. BUG-010 — done
3. Branch protection — done
4. First npm publish **0.1.1** — done; remaining: Trusted Publisher on each package (`docs/publishing.md`)
5. Post-publish BUG-004 / BUG-006 — done
6. **Typed DX v1** — `generateDts` uses `Props`, `LoadContext`/`ExtractParams` from `LoadEvent` annotations, `ActionHandler` / `ApiHandler`; docs + `route('/posts/:id')` in basic-app
7. Later: docs/landing · Playwright e2e · Cloudflare/Bun adapters · Trusted Publisher OIDC

## Commands

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
