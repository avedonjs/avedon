# memories.md

Updated: 2026-07-26

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
- **Compiler (2026-07-22):** client `<script lang="ts">` now runs through `stripTypeScript` (was server-only) — type annotations no longer break Vite/esbuild JS parse.
- **npm (2026-07-22/23):** **0.1.1 → 0.2 adapters / 0.1.2**; Trusted Publisher OIDC on all 10 packages; **`NPM_TOKEN` removed** — Release is OIDC-only (`release.yml`)
- **Fix round (2026-07-22):** committed as `babdfa0` (path traversal, pack smoke, audit remediations). Audit artefacts relocated under `docs/superpowers/audits/2026-07-22/`.
- **Pre-publish gate plan:** `docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md`
- **Branch protection (2026-07-22/23):** `main` requires Install, Typecheck, Build, Test, Smoke tests, Playwright tests, `Analyze (javascript-typescript)` on PR merges; direct pushes allowed (`enforce_admins` false).
- **Adapters:** `@avedon/adapter-node` production-ready; **`@avedon/adapter-cloudflare` Workers+Assets (2026-07-23)**; **`@avedon/adapter-bun` Bun.serve + ISR (2026-07-23)**
- **Push (2026-07-23):** Playwright expansion on `origin/main` (`d1e81dd` + publishing docs).

## Bilinen Sorunlar (2026-07-26 gap analizi)

Build + 183 unit test yeşil, ama derleyicide **sessiz** (hata vermeyen) boşluklar var:

- ~~BLOCKER — Alt bileşen kompozisyonu~~ **ÇÖZÜLDÜ (2026-07-26):** PascalCase + default import → `Comp.render`/`mount`; props, `on:` → `on*` prop, default slot; child CSS parent `css` export'una eklenir. İmport yoksa derleme hatası.
- ~~`{@const}` geçersiz JS / `bind:checked` sessiz / named slot / spread~~ **ÇÖZÜLDÜ (2026-07-26):** hepsi artık net derleme hatası (`validateTokens`/`validateAttrs`); `bind:value` inputlarda çalışmaya devam ediyor. `asUiComponent` compile opsiyonu `<script server>`'ı reddediyor (plugin auto-wire ertelendi).
- ~~Sayfa başına `<head>`/title/meta API'si yok~~ **ÇÖZÜLDÜ (2026-07-26):** `load` artık `head: { title, description, html }` döndürebiliyor; www'nin 17 sayfası da benzersiz title/description üretiyor.
- Post-v1 sayılabilir eksikler: keyed `{#each}` (net hata fırlatıyor — kabul edilebilir), `{#key}`, `transition:`, `use:`, `class:` / `style:` direktifleri.

## Next steps (priority, 2026-07-22)

Plan: `docs/superpowers/plans/2026-07-22-pre-publish-release-gate.md`

1. Housekeeping — done
2. BUG-010 — done
3. Branch protection — done
4. First npm publish **0.1.1** — done; remaining: Trusted Publisher on each package (`docs/publishing.md`)
5. Post-publish BUG-004 / BUG-006 — done
6. **Typed DX v1** — done (2026-07-22): `generateDts` Props / LoadEvent params / ActionHandler; docs + basic-app `route('/posts/:id')`
7. **Docs site** — done (2026-07-22): `apps/www` SSG + MD pipeline + `{@html}`; live on Cloudflare Pages **https://avedon.pages.dev** (`pages:deploy` + `.github/workflows/pages.yml`; needs `CLOUDFLARE_*` secrets for CI)
7b. **End-user docs IA** — done (2026-07-22): `docs/manifest.json` grouped nav; app-dev IA (`quick-start`, tutorial, concepts, guides); old `guide`/`packages`/`avedon-components` removed + CF `_redirects`; spec `docs/superpowers/specs/2026-07-22-end-user-docs-design.md`
7c. **Docs syntax highlighting** — done (2026-07-23): Shiki at generate-time; `ts`/`js`/`bash`/…; `.ave` via section split (script→TS, style→CSS, template→Svelte) in `apps/www/scripts/highlight.mjs`
7d. **www Lighthouse a11y/SEO** — done (2026-07-23): robots+sitemap, meta description, single `<main>` landmark, contrast/touch/underlines, high-contrast Shiki; local+live a11y/SEO **100** (Lighthouse)
8. **Playwright e2e expansion** — done (2026-07-23): CI job `Playwright tests` + branch protection; `e2e/browser-gaps.spec.ts`; `e2e/www.spec.ts` + `playwright.www.config.ts`; enhance() follows action redirect URL; CSR marker typo fix; stale smoke/hmr assertions updated; spec/plan under `docs/superpowers/{specs,plans}/2026-07-23-playwright-e2e-expansion*`
9. **Trusted Publisher OIDC** — done (2026-07-23): configured on all 10 packages; **NPM_TOKEN removed** — Release is OIDC-only (`release.yml` + `docs/publishing.md`)
9b. **@avedon/adapter-cloudflare** — done (2026-07-23): Workers + Assets; SSG; no ISR; `e2e/cloudflare-adapt-smoke.mjs`; spec/plan under `docs/superpowers/{specs,plans}/2026-07-23-adapter-cloudflare*`
9c. **@avedon/adapter-bun** — done (2026-07-23): Bun.serve + safe static + SSG/ISR SWR; `e2e/bun-adapt-smoke.mjs`; spec/plan under `docs/superpowers/{specs,plans}/2026-07-23-adapter-bun*`
10. **Security / CI gate (2026-07-23):** Dependabot + CodeQL closed (esbuild/sharp overrides, www HTML helpers, `*.ave` shim, create-smoke)
11. **Release 0.2 adapters (2026-07-23):** Version Packages PR #2 merged; npm published `@avedon/adapter-{cloudflare,bun}@0.2.0`, `avedon`/`@avedon/runtime`/`@avedon/server` `@0.1.2` (and related patches). Release run: https://github.com/avedonjs/avedon/actions/runs/30040463331
12. **OIDC-only publish (2026-07-23):** `NPM_TOKEN` removed; proof publish `avedon@0.1.3` via Trusted Publisher
12b. **create-avedon-app --adapter (2026-07-23):** implemented — `node`/`cloudflare`/`bun` via prompt + `--adapter=`; `applyAdapter`; docs; plan `docs/superpowers/plans/2026-07-23-create-app-adapter.md`
13. **Component composition — done (2026-07-26):** spec + plan under `docs/superpowers/{specs,plans}/2026-07-26-component-composition*`; compiler (detect/SSR/stream/client/fail-closed/`asUiComponent`), basic-app `Counter.ave` + `e2e/component-composition.spec.ts`, `docs/components.md` updated. Verified: 199 unit, typecheck, smoke, 19 Playwright — all green. **Uncommitted.**
14. **Per-page `<head>` — done (2026-07-26):** spec + plan under `docs/superpowers/{specs,plans}/2026-07-26-page-head*`. `load` returns `head: { title, description, html }`; `title`/`description` escaped, `html` trusted. `HeadMeta` in `@avedon/shared`; `renderShellPrefix` replaces-or-appends title/description in `app.html`. **Streaming SSR needs `awaitHead: true`** (route opt-in) — head is only known after `load`, and always waiting would break the ttfb-smoke budget (41ms vs 800ms load). Without the flag the head is ignored: dev throws (`createHandler({ dev: true })` from the Vite middleware), prod warns — deterministic, never depends on load speed. SSG/CSR/`bufferHtml` work with no flag. `route()` helper also gained the previously missing `bufferHtml`. Client nav needed no change (`applyDocument` already syncs `<title>`). Verified: 212 unit, typecheck, all smoke (ttfb + stream-redirect unchanged), 21 Playwright — green. **Uncommitted.**
14b. **www dogfoods component composition (2026-07-26):** extracted `apps/www/src/components/` — `SiteHeader` (Layout), `DocsSidebar` (Doc+DocsIndex, `slug` active-state), `Toc`+`Pager` (Doc), `DocHub` (DocsIndex). Scoped CSS per component aggregates into each page's `css` export; verified in built HTML (`.side[avedon-…]` matches element hash). Clean build/typecheck/www-e2e green. Note: re-running `avedon build` over an existing `build/` dir prints a benign vite dep-scan "server restarted/outdated" warning; clean build is silent.
15. **Next:** domain/launch housekeeping in progress (2026-07-26): stale stub docs fixed; composition+head changeset added; absolute OG + `AVEDON_DOCS_ORIGIN`; `.generated-test` gitignored. Remaining: merge Version Packages PR after push; custom domain cutover when purchased.

## Domain öncesi gap listesi (2026-07-26)

**Sahte / yarı-gerçek:**
- `hydrate` = soft rebuild (`mount` → `replaceChildren`), gerçek DOM reuse yok; client nav `#app.innerHTML` swap
- Child bileşenler client'ta hep `.mount()` (hydrate yolunda da)
- ~~README/CONTRIBUTING hâlâ adapter'ları "stub" diyor~~ **düzeltildi**
- www: `nodeAdapter` + Pages'e sadece `build/client` — CF adapter dogfood yok
- ORM scaffold: config stub only (bilinçli)
- `asUiComponent` auto-wire yok (manuel/opsiyonel)

**Önemli açıklar (launch güvenilirliği):**
- ~~Composition + head npm changeset~~ **changeset eklendi** — Version Packages PR / publish bekliyor
- ~~Sitemap/robots / OG absolute~~ **hazır** (`AVEDON_DOCS_ORIGIN`, default pages.dev)
- CF adapter: ISR yok (dokümante)
- `.ave` language service / LSP yok

**Kabul edilebilir post-v1:** keyed each, `{#key}`, transitions, named slots, event dispatcher, on-demand ISR

## Commands

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
