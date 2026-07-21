# memories.md

Updated: 2026-07-21

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

## Status

- **Rename (2026-07-21):** project and GitHub org `avedon` / `avedonjs`; old `vexjs` name unused in the codebase
- DoD: `pnpm build`, `pnpm test`, `pnpm test:smoke` passed (after 2026-07-21 rename)
- **Audit pass (2026-07-21):** create monorepo `file:` link + `e2e/create-smoke.mjs`; CSRF Origin/Referer docs; streaming TTFB unit test; `e2e/isr-smoke.mjs`; basic-app login + `requireSession`; action redirect + Set-Cookie fix; `getSession` export
- **Streaming SSR default (2026-07-21):** `earlyShell` removed; SSR streams by default + ~40ms shell delay; post-shell redirect → `window.location` script; `bufferHtml` opt-out; `/login` bufferHtml; `e2e/stream-redirect-smoke.mjs`
- **GitHub Actions (2026-07-21):** `ci.yml`, `e2e.yml`, `release.yml`, `codeql.yml`; Changesets (`@changesets/cli`); CI/E2E/CodeQL green; Release awaits `NPM_TOKEN` (ENEEDAUTH expected); smoke orphan process-tree kill fix; branch protection guidance in CONTRIBUTING.md
- **CodeQL alerts (2026-07-21):** 12→0→3→1; final XSS (`js/xss-through-dom`) fixed via OOO payload JSON→`<template>` clone (`settleAvedonStream` no longer does text→innerHTML)
- **Docs language (2026-07-21):** repo docs English-only; `logo/README.md` translated from Turkish
- **Starter home (2026-07-21):** dark-stage template + basic-app home (Syne, `#09090B`, `#06B6D4`, live `signal` demo); spec `docs/superpowers/specs/2026-07-21-starter-home-design.md`
- **Create-app add-ons (2026-07-21):** design approved — optional Tailwind (style convert) + ORM wiring (Drizzle/Prisma/none, no schema); interactive + flags; spec `docs/superpowers/specs/2026-07-21-create-app-addons-design.md` (plan pending)

## Commands

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
