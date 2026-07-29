# memories.md

Updated: 2026-07-29

## Bug audit — fix notes (2026-07-29)

**FIXED (2026-07-29):** Aşağıdaki P1/P2 maddeleri kodlandı + unit regression’lar (`audit regressions 2026-07-29`, signal dispose/stale-deps).

### Yapılanlar
1. Runtime `effect()` — dep reverse-map; dispose + rerun stale dep temizliği
2. `hydrate()` destroy — canlı `target` temizleniyor
3. `{#if}` branch identity + nested `__effect` (child remount yok)
4. `{#key}` — nested effects; key aynıyken body reactive
5. `{#await}` — gen cancel + effect’e bağlı; nested effects
6. Block destroy cleanups root’a register
7. SSR `signalNames` + `sigExpr` (boolean/text/attrs/props/html/const)
8. Signal-script: compound/`++`, AST collect (nested/string yok), property-name skip
9. Balanced JS mustache parser (`{JSON.stringify({a:1})}`)
10. SSR/client spread attr-name validation; protected explicit keys
11. Component spread stale keys → `undefined` + update delete
12. `bind:*` duck-type `.get`/`.set`
13. CSS: `:is()` comma, `::before` hash, `:global` marker
14. Transition style snapshot/restore
15. Playground `postMessage` origin; `session.set` write chain

### Bilinçli kalan
- Soft hydrate = remount + restore (DOM reuse yok)
- CF ISR yok; `.ave` LSP yok
- ASI: `signal(false)\\n()` sonraki satıra yapışır — deklarasyon sonrası `;` veya boş satır

### Önceki audit
- 2026-07-22: `docs/superpowers/audits/2026-07-22/`

---

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

- Stay on main; commit only when asked
- TypeScript: stay on 5.x for now; skip 6 bump — wait for **7.1** (stable programmatic API) before major TS upgrade (2026-07-22)
- Creative feature loop: **paused** for release (2026-07-29) — user asked to publish accumulated features; do not re-arm `AGENT_LOOP_WAKE_avedon_build` until asked
- Prior loop heartbeat was **~5m** (`sleep 300`)
- **Playground dogfood (2026-07-29):** playground’da potansiyel framework bug görünce etrafından dolanma — `packages/*` içinde fixle + test. Rule: `.cursor/rules/playground-fix-framework-bugs.mdc`
- **Published (2026-07-29):** Version Packages PR #6 merged; OIDC publish succeeded — `avedon@0.1.6`, `@avedon/runtime@0.2.0`, `@avedon/compiler@0.3.0`, `@avedon/server@0.2.2`, `@avedon/vite-plugin@0.1.5`, `@avedon/adapter-node@0.1.5`, `@avedon/adapter-{bun,cloudflare}@0.2.3`. Release: https://github.com/avedonjs/avedon/actions/runs/30429125581

## Status

- **Playground CodeMirror empty on Pages (2026-07-29):** Vite extracts CM CSS to `/assets/client-*.css` but SSG HTML never linked it → black text on dark bg, no gutters. Fix: `clientCss` in shell prefix + CLI/adapters. **Uncommitted → shipping.**
- **Published (2026-07-29 evening):** Playground+Tailwind+fixes — PR #7 merged; OIDC publish — `avedon@0.1.7`, `@avedon/compiler@0.4.0`, `@avedon/runtime@0.2.1`, `@avedon/server@0.2.3` (+ adapters/vite-plugin/cli bumps). Live: https://avedon.pages.dev/playground/ — Release: https://github.com/avedonjs/avedon/actions/runs/30466780448
- **www playground Tailwind (2026-07-29):** iframe loads local `/playground-tailwind.js` (`@tailwindcss/browser@4.1.11`); create-app `@theme` tokens; all presets utility-styled. Also fixed sandboxed iframe `postMessage` targetOrigin (`'*'`). Signal-script: do not unwrap args to `readonly()`. Spec/plan under `docs/superpowers/{specs,plans}/2026-07-29-playground-tailwind*`. **Published.**
- **URGENT create-app runtime range (2026-07-29):** Template pinned `@avedon/runtime@^0.1.0` → npm 0.1.2 (no `__contextBegin`); compiler 0.4 emits it → Vite error. Fix: template `runtime ^0.2.1` + `server ^0.2.3`. Existing apps: `npm i @avedon/runtime@^0.2.1 @avedon/server@^0.2.3`.
- **www Product-stage Tailwind (2026-07-29):** Site chrome rebuilt with Tailwind v4 PostCSS; home no-scroll + mouse grid glow + install in hero. Deployed: https://github.com/avedonjs/avedon/actions/runs/30488921216 (`8a6d969`). Live: https://avedon.pages.dev/
- **www home Counter specimen highlight (2026-07-29):** Hand-rolled `tok-*` → Shiki `highlightAve` → `.generated/home-specimen.json`. Deployed: https://github.com/avedonjs/avedon/actions/runs/30479712621 (`661a8df`).
- **www home denser (2026-07-29):** denser home + Counter specimen. **Published with playground batch.**
- **www playground (2026-07-29):** `/playground` live REPL. **Published.**
- **Published (2026-07-29):** Version Packages PR #6 merged; OIDC publish succeeded — `avedon@0.1.6`, `@avedon/runtime@0.2.0`, `@avedon/compiler@0.3.0`, `@avedon/server@0.2.2`, `@avedon/vite-plugin@0.1.5`, `@avedon/adapter-node@0.1.5`, `@avedon/adapter-{bun,cloudflare}@0.2.3`. Release: https://github.com/avedonjs/avedon/actions/runs/30429125581
- **Playground CodeMirror height (2026-07-29):** Editör varsayılan 300px’te kalıyordu çünkü scoped CSS `.CodeMirror[hash]` üretiyor; CM runtime’da oluştuğu için hash yok → kural eşleşmiyor. Fix: `Playground.ave` stilleri `unscoped` (`.pg-*` prefix), Layout flex zinciri (`shell`/`page-main`), `setSize('100%','100%')` + `refresh()`. Önceki oturum yarım kalmıştı (yalnızca layout/`vh` denemesi).
- **scopeCss `@keyframes` bug (2026-07-29):** scoped CSS was rewriting `to`/`from`/`0%` inside `@keyframes` as `to[hash]`, breaking animations. Fix: leave `@keyframes` / `@font-face` / `@property` bodies unscoped.
- DoD: `pnpm build`, `pnpm test`, `pnpm test:smoke` passed (after 2026-07-21 rename)
- **Audit pass (2026-07-21):** create monorepo `file:` link + `e2e/create-smoke.mjs`; CSRF Origin/Referer docs; streaming TTFB unit test; `e2e/isr-smoke.mjs`; basic-app login + `requireSession`; action redirect + Set-Cookie fix; `getSession` export
- **Streaming SSR default (2026-07-21):** `earlyShell` removed; SSR streams by default + ~40ms shell delay; post-shell redirect → `window.location` script; `bufferHtml` opt-out; `/login` bufferHtml; `e2e/stream-redirect-smoke.mjs`
- **GitHub Actions (2026-07-21):** `ci.yml`, `e2e.yml`, `release.yml`, `codeql.yml`; Changesets (`@changesets/cli`); CI/E2E/CodeQL green; Release awaits `NPM_TOKEN` (ENEEDAUTH expected); smoke orphan process-tree kill fix; branch protection guidance in CONTRIBUTING.md
- **CodeQL alerts (2026-07-21):** 12→0→3→1; final XSS (`js/xss-through-dom`) fixed via OOO payload JSON→`<template>` clone (`settleAvedonStream` no longer does text→innerHTML)
- **CodeQL alerts (2026-07-26):** 5 open → 0. `codegen.ts` component prop keys/values now use `jsLiteral` (js/bad-code-sanitization #19); `ssr.ts` `applyHead` title/description use linear scanning helpers instead of backtracking regex (js/polynomial-redos #20-23). Fix `69f6eeb` + changeset `0304df9` (compiler/server patch). Verified: 214 unit green, CodeQL run 30200566281 → 0 open.
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
- ~~`{@const}` geçersiz JS / `bind:checked` sessiz / named slot / spread~~ **ÇÖZÜLDÜ (2026-07-26):** fail-closed; named slots **sonradan eklendi** (2026-07-26). `asUiComponent` auto-wire eklendi.
- ~~Sayfa başına `<head>`/title/meta API'si yok~~ **ÇÖZÜLDÜ (2026-07-26):** `load` artık `head: { title, description, html }` döndürebiliyor; www'nin 17 sayfası da benzersiz title/description üretiyor.
- Post-v1 sayılabilir eksikler: other transitions beyond fade/fly/slide/scale/blur. `{#key}`, keyed `{#each}`, named slots, `class:`, `style:`, `use:`, `transition:fade`/`fly`/`slide`/`scale`/`blur`, binds, event dispatcher **destekleniyor**.

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
14b. **www dogfoods component composition (2026-07-26):** extracted `apps/www/src/components/` — `SiteHeader` (Layout), `DocsSidebar` (Doc+DocsIndex, `slug` active-state), `Toc`+`Pager` (Doc), `DocHub` (DocsIndex). Scoped CSS per component aggregates into each page's `css` export; verified in built HTML (`.side[avedon-…]` matches element hash). Clean build/typecheck/www-e2e green.
14c. **Dirty rebuild silence (2026-07-26):** `avedon build` now clears both `.avedon/` and `build/` via `prepareBuildDirs` before Vite starts, so dep-scan no longer races closed servers against stale SSG HTML. Unit + dirty www rebuild verified silent. Changeset `cli-clean-build-dir`. **Uncommitted.**
15. **Domain launch prep (2026-07-26):** stale stub docs fixed; absolute OG + `AVEDON_DOCS_ORIGIN`; `.generated-test` gitignored; composition+head published — `avedon@0.1.4`, `@avedon/{compiler,server,shared}@0.2.0`. Custom domain cutover: set repo Variable `AVEDON_DOCS_ORIGIN`, regenerate/redeploy, bind domain in CF Pages.
16. **Release PR unblock (2026-07-26):** CodeQL changeset version bump failed to open PR (Actions token read-only at org; cannot create PRs). Manual Version Packages PR #5 merged (`cba6cd1`). OIDC publish succeeded — `avedon@0.1.5`, `@avedon/{compiler,server}@0.2.1`, `@avedon/adapter-{cloudflare,bun}@0.2.2`, `@avedon/{adapter-node,vite-plugin}@0.1.4`. Org admin still needed to allow workflow write / Actions PR creation. Docs note in `docs/publishing.md`.
17. **Feature batch release (2026-07-29):** Feature loop paused. Large uncommitted runtime/compiler/cli batch (~179 changesets) committed for Version Packages → npm publish.
17. **CI action Node 24 bump (2026-07-26):** workflows → `checkout@v5`, `setup-node@v5` (`package-manager-cache: false`), `cache@v5`, `pnpm/action-setup@v5`, CodeQL action `@v4`; CI/E2E Node **22** (aligned with Release). Soft-hydrate honesty documented in `docs/rendering.md` + `docs/components.md`. **Uncommitted** (with prepareBuildDirs WIP).
18. **asUiComponent auto-wire (2026-07-26):** `@avedon/vite-plugin` marks non-route `.ave` via `collectRouteAvePaths`/`isRouteAveModule`; builds example+www green. Changeset `vite-plugin-as-ui-auto`. **Uncommitted.**
19. **WIP full verification (2026-07-26 18:10):** tüm bekleyen WIP ile (prepareBuildDirs + Actions v5/Node22 + asUiComponent auto-wire) komple paket yeşil: typecheck, build, unit, tüm smoke (ttfb 41ms), 21+4 Playwright.
20. **Client nav replaceChildren (2026-07-26):** runtime `moveChildNodes` — `#app` swap no longer uses `innerHTML`. Unit + docs. Changeset `runtime-nav-replace-children`. **Uncommitted.**
21. **WIP full verification (2026-07-26 19:13):** prepareBuildDirs + Actions v5/Node22 + asUiComponent auto-wire + moveChildNodes — typecheck/build/unit/smoke/e2e hepsi yeşil (ttfb 41ms).
23. **Loop restart (2026-07-26):** creative autonomous feature loop armed (`AGENT_LOOP_WAKE_avedon_build`, ~25m heartbeat). Goal this tick: implement `{#key expr}` remount blocks.
24. **`{#key}` landed (2026-07-26):** parse/emit SSR+stream+client remount via `Object.is`; docs + unit tests; changeset `compiler-key-block`. **Uncommitted.**
25. **Keyed `{#each}` landed (2026-07-26):** `(item.id)` syntax; client Map reconciliation preserves DOM identity across reorder, rejects duplicate keys, rebuilds changed item values; SSR parity. Unit + Playwright DOM identity test (`/keyed-each-lab`). Included in `compiler-key-block`. **Uncommitted.**
26. **Named slots landed (2026-07-26):** `<slot name>` + parent `slot="…"` → `slots` prop; default `<slot />` / `children` unchanged; fallback supported. Unit + `/named-slots-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
27. **`class:` directive landed (2026-07-26):** element `class:name={expr}` (+ identifier shorthand); merges with `class`; SSR + client; rejected on components. Unit + `/class-directive-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
28. **`style:` directive landed (2026-07-26):** element `style:prop={expr}` (+ identifier shorthand); merges with `style`; omits on null/undefined/false; SSR + client. Unit + `/style-directive-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
29. **`bind:checked` landed (2026-07-26):** native input two-way checkbox binding (SSR conditional `checked` + client `change`); `bind:group` still fail-closed. Unit + `/bind-checked-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
30. **`createEventDispatcher` landed (2026-07-26):** runtime `dispatch('name', detail)` → parent `on:name` (`onname` prop); compiler rewrites bare `createEventDispatcher()` to `__props`. Unit + `/event-dispatcher-lab` Playwright. Changeset `runtime-event-dispatcher`. **Uncommitted.**
31. **`use:` actions landed (2026-07-26):** element `use:fn` / `use:fn={params}`; client-only; cleanup via mount `__cleanups`; `update`/`destroy` return shape. Unit + `/use-action-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
32. **`bind:this` landed (2026-07-26):** element ref binding (client assign + cleanup `null`); SSR ignored. Unit + `/bind-this-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
33. **`bind:group` landed (2026-07-26):** radio group binding vs `value` (SSR + client); later same day: **checkbox arrays** when `type="checkbox"`. Unit + `/bind-group-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
34. **`transition:fade` landed (2026-07-26):** client intro opacity fade (+ optional `duration`); SSR ignored. Unit + `/transition-fade-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
35. **Loop pace (2026-07-26):** creative heartbeat shortened **~25m → ~5m** (`sleep 300`) per user request.
36. **`onMount` / `onDestroy` landed (2026-07-26):** runtime lifecycle + compiler mount wiring; unit + `/lifecycle-lab` Playwright. Changeset `runtime-lifecycle`. **Uncommitted.**
37. **Signal-driven template effects (2026-07-26):** client mount registers `__effects` via runtime `effect()` so `{signal}` updates without relying only on `__invalidate`. Unit + `/signal-effect-lab` Playwright. Changeset `compiler-signal-effects`. **Uncommitted.**
38. **`{:else if}` landed (2026-07-26):** nested if-chain parse; client/SSR-stream flatten to `if / else if / else` (nested client if left orphan DOM under signal updates). Unit + `/else-if-lab` Playwright green. Folded into `compiler-key-block`. **Uncommitted.**
39. **Creative loop wake (2026-07-27):** finished else-if client flatten fix; heartbeat still ~5m.
40. **`{#each} {:else}` landed (2026-07-27):** empty-list branch (SSR/stream/client, keyed+unkeyed); unit + `/each-else-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
41. **`{@const}` landed (2026-07-27):** sibling-scoped locals (SSR IIFE / stream block / client lexical); unit + `/const-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
42. **`{#await}` pending landed (2026-07-27):** first block kept until then/catch; client + sync SSR + stream placeholder `pendingHtml`; unit + `/await-pending-lab` Playwright. Changeset `await-pending`. **Uncommitted.**
43. **Event modifiers landed (2026-07-27):** `preventDefault` / `stopPropagation` / `once` / `self` / `capture` on `on:…`; modifier-only ok; unit + `/event-modifiers-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
44. **HTML comments stripped (2026-07-27):** `<!-- … -->` skipped in tokenize (was leaking as text); unit + `/comment-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
45. **`{#await p then v}` / `catch` shorthand (2026-07-27):** header bindings skip pending block; unit + `/await-then-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
46. **Boolean attrs (2026-07-27):** `disabled={…}` / `hidden` / `required` / … omit when falsy (SSR + client IDL props); unit + `/boolean-attr-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
47. **`<select bind:value>` (2026-07-27):** client `change` listener; SSR marks matching `<option selected>`; unit + `/select-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
48. **`transition:fade` outro (2026-07-27):** `__avedonOutro` + `__runOutro` on `{#if}` / unkeyed `{#each}`; unit + `/fade-outro-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
49. **Keyed `{#each}` fade outro (2026-07-27):** leaving records outro before remove (skip leaving nodes while reordering); unit + `/keyed-outro-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
50. **`transition:fly` landed (2026-07-27):** translate+opacity intro/outro (`x`/`y`/`duration`); unit + `/fly-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
51. **`in:` / `out:` transitions landed (2026-07-27):** intro-only / outro-only for `fade`/`fly`; unit + `/in-out-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
52. **`transition:slide` landed (2026-07-27):** height+opacity intro/outro (`duration`); also `in:slide` / `out:slide`; unit + `/slide-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
53. **`transition:scale` landed (2026-07-27):** scale+opacity intro/outro (`start`/`duration`); also `in:scale` / `out:scale`; unit + `/scale-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
54. **Element `{...spread}` landed (2026-07-27):** SSR+client attr bags; skips `on*` / `:` keys; unit + `/spread-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
55. **Component `{...props}` spreads landed (2026-07-27):** `Object.assign` merge (order-preserving); unit + `/comp-spread-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
56. **`bind:files` landed (2026-07-27):** file input → `FileList` on `change` (SSR ignored); unit + `/files-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
57. **Event modifiers `passive` + `stopImmediatePropagation` (2026-07-27):** unit + `/event-modifiers-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
58. **`transition:blur` landed (2026-07-27):** filter blur+opacity (`amount`/`duration`); also `in:blur` / `out:blur`; unit + `/blur-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
59. **Dimension binds landed (2026-07-27):** `bind:clientWidth` / `clientHeight` / `offsetWidth` / `offsetHeight` via `ResizeObserver`; unit + `/dimension-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
60. **`bind:scrollTop` / `scrollLeft` landed (2026-07-27):** two-way scroll position; unit + `/scroll-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
61. **`bind:indeterminate` landed (2026-07-27):** checkbox IDL property (client effect); unit + `/indeterminate-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
62. **`bind:open` landed (2026-07-27):** `<details>`/`<dialog>` open state (SSR attr + client `toggle`); unit + `/open-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
63. **`bind:muted` / `bind:paused` landed (2026-07-27):** media element binds; unit + `/media-bind-lab` Playwright (`muted`). Folded into `compiler-key-block`. **Uncommitted.**
64. **`bind:volume` / `bind:currentTime` landed (2026-07-27):** media volume + seek; unit + `/media-bind-lab` Playwright (`volume`). Folded into `compiler-key-block`. **Uncommitted.**
65. **`bind:playbackRate` / `bind:duration` landed (2026-07-27):** media rate + duration readout; unit + `/media-bind-lab` Playwright (`playbackRate`). Folded into `compiler-key-block`. **Uncommitted.**
66. **`bind:textContent` landed (2026-07-27):** contenteditable two-way text; unit + `/textcontent-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
67. **`transition:draw` + SVG NS landed (2026-07-27):** stroke-dashoffset draw on SVG geometry; client `createElementNS` (context-aware); unit + `/draw-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
68. **`nonpassive` event modifier landed (2026-07-27):** `on:wheel|nonpassive` → `{ passive: false }`; rejects combo with `passive`; unit + `/event-modifiers-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
69. **Numeric `bind:value` landed (2026-07-27):** static `type="number"` / `range` → `valueAsNumber` (empty → `undefined`); unit + `/number-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
70. **Multi-select `bind:value` landed (2026-07-27):** `<select multiple>` ↔ `string[]` (SSR selected + client `selectedOptions`); unit + `/multi-select-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
71. **Transition `delay` option landed (2026-07-27):** CSS transition-delay for fade/fly/slide/scale/blur/draw; unit + `/transition-delay-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
72. **Transition `easing` option landed (2026-07-27):** CSS timing-function (`easing: 'linear'` / `cubic-bezier(…)`); unit + `/transition-easing-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
73. **`tick()` landed (2026-07-27):** `@avedon/runtime` Promise after pending DOM updates (double microtask); unit + `/tick-lab` Playwright. Changeset `runtime-tick`. **Uncommitted.**
74. **`untrack()` landed (2026-07-27):** read signals inside an effect without subscribing; unit + `/untrack-lab` Playwright. Changeset `runtime-untrack`. **Uncommitted.**
75. **Context API landed (2026-07-27):** `setContext` / `getContext` / `hasContext` + `__contextBegin` on SSR/mount; unit + `/context-lab` Playwright. Changeset `runtime-context`. **Uncommitted.**
76. **`beforeUpdate` / `afterUpdate` landed (2026-07-27):** update lifecycle hooks; unit + `/update-hooks-lab` Playwright. Changeset `runtime-update-hooks`. **Uncommitted.**
77. **`mediaQuery()` landed (2026-07-27):** read-only matchMedia signal; unit + `/media-query-lab` Playwright. Changeset `runtime-media-query`. **Uncommitted.**
78. **`persistedSignal()` landed (2026-07-27):** localStorage JSON signal + storage sync; unit + `/persisted-signal-lab` Playwright. Changeset `runtime-persisted-signal`. **Uncommitted.**
79. **`onlineSignal()` landed (2026-07-27):** navigator.onLine read-only signal; unit + `/online-signal-lab` Playwright. Changeset `runtime-online-signal`. **Uncommitted.**
80. **`visibilitySignal()` landed (2026-07-27):** document.visibilityState signal; unit + `/visibility-signal-lab` Playwright. Changeset `runtime-visibility-signal`. **Uncommitted.**
81. **`persistedSignal` sessionStorage option (2026-07-27):** `{ storage: 'session' }`; unit + lab Playwright. Folded into `runtime-persisted-signal`. **Uncommitted.**
82. **Soft hydrate focus restore (2026-07-27):** `captureFocus`/`restoreFocus` on remount; unit + `/soft-hydrate-focus-lab` Playwright. Changeset `runtime-soft-hydrate-focus`. **Uncommitted.**
83. **Soft hydrate form restore (2026-07-27):** `captureFormState`/`restoreFormState` for inputs/selects; unit + `/soft-hydrate-form-lab` Playwright. Changeset `runtime-soft-hydrate-form`. **Uncommitted.**
84. **Soft hydrate scroll restore (2026-07-27):** `captureScrollState`/`restoreScrollState` for element + window scroll; unit + `/soft-hydrate-scroll-lab` Playwright. Changeset `runtime-soft-hydrate-scroll`. **Uncommitted.**
85. **`batch()` landed (2026-07-27):** coalesce signal notifications across writes; unit + `/batch-lab` Playwright. Changeset `runtime-batch`. **Uncommitted.**
86. **Soft hydrate open restore (2026-07-27):** `captureOpenState`/`restoreOpenState` for details/dialog; unit + `/soft-hydrate-open-lab` Playwright. Changeset `runtime-soft-hydrate-open`. **Uncommitted.**
87. **`windowSize()` landed (2026-07-27):** read-only innerWidth/innerHeight signal; unit + `/window-size-lab` Playwright. Changeset `runtime-window-size`. **Uncommitted.**
88. **`pageScroll()` landed (2026-07-27):** read-only scrollX/scrollY signal; unit + `/page-scroll-lab` Playwright. Changeset `runtime-page-scroll`. **Uncommitted.**
89. **Media `bind:ended` / `bind:seeking` (2026-07-27):** read from media element events; unit + `/media-ended-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
90. **Media `bind:readyState` (2026-07-27):** read `HTMLMediaElement.readyState`; unit + `/media-ready-state-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
91. **Media `bind:videoWidth` / `bind:videoHeight` (2026-07-27):** read video metrics on metadata/resize; unit + `/media-video-size-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
92. **`readonly()` landed (2026-07-27):** wrap a signal to reject writes; unit + `/readonly-lab` Playwright. Changeset `runtime-readonly`. **Uncommitted.**
93. **Image `bind:naturalWidth` / `bind:naturalHeight` (2026-07-27):** read on load/error; unit + `/image-natural-size-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
94. **`devicePixelRatio()` landed (2026-07-27):** read-only DPR signal; unit + `/device-pixel-ratio-lab` Playwright. Changeset `runtime-device-pixel-ratio`. **Uncommitted.**
95. **`style:--*` CSS variables verified (2026-07-27):** custom properties via `style:--name={expr}`; unit + `/style-css-var-lab` Playwright; docs. Folded into `compiler-key-block`. **Uncommitted.**
96. **`portal` use-action (2026-07-27):** move node into host/selector; unit + `/portal-lab` Playwright. Changeset `runtime-portal`. **Uncommitted.**
97. **`clickOutside` use-action (2026-07-27):** pointerdown outside element; unit + `/click-outside-lab` Playwright. Changeset `runtime-click-outside`. **Uncommitted.**
98. **`focusTrap` use-action (2026-07-27):** Tab cycle + autofocus; unit + `/focus-trap-lab` Playwright. Changeset `runtime-focus-trap`. **Uncommitted.**
99. **`lockScroll` use-action (2026-07-27):** document overflow lock with refcount; unit + `/lock-scroll-lab` Playwright. Changeset `runtime-lock-scroll`. **Uncommitted.**
100. **`escapeKey` use-action (2026-07-27):** Escape key handler; unit + `/escape-key-lab` Playwright. Changeset `runtime-escape-key`. **Uncommitted.**
101. **`inView` use-action (2026-07-27):** IntersectionObserver helper; unit + `/in-view-lab` Playwright. Changeset `runtime-in-view`. **Uncommitted.**
102. **`prefersReducedMotion()` (2026-07-27):** mediaQuery convenience; unit + `/prefers-reduced-motion-lab` Playwright. Changeset `runtime-prefers-reduced-motion`. **Uncommitted.**
103. **`hotkey` use-action (2026-07-27):** document key shortcuts with modifiers; unit + `/hotkey-lab` Playwright. Changeset `runtime-hotkey`. **Uncommitted.**
104. **Reduced-motion transitions (2026-07-27):** `transitionMs` zeros duration/delay under `prefers-reduced-motion`; unit + `/reduced-motion-transition-lab` Playwright. Changesets `runtime-transition-ms` + compiler-key-block. **Uncommitted.**
105. **`bind:selectionStart` / `selectionEnd` (2026-07-27):** two-way caret range on text inputs/textareas; unit + `/selection-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
106. **`prefersColorScheme()` (2026-07-27):** `'light' | 'dark'` mediaQuery convenience; unit + `/prefers-color-scheme-lab` Playwright. Changeset `runtime-prefers-color-scheme`. **Uncommitted.**
107. **`longPress` use-action (2026-07-27):** hold pointer to fire handler; unit + `/long-press-lab` Playwright. Changeset `runtime-long-press`. **Uncommitted.**
108. **`autofocus` use-action (2026-07-27):** focus element after mount; unit + `/autofocus-lab` Playwright. Changeset `runtime-autofocus`. **Uncommitted.**
109. **`copy` use-action (2026-07-27):** clipboard write on click; unit + `/copy-lab` Playwright. Changeset `runtime-copy`. **Uncommitted.**
110. **`hover` use-action (2026-07-27):** pointer enter/leave reporter; unit + `/hover-lab` Playwright. Changeset `runtime-hover`. **Uncommitted.**
111. **`focusWithin` use-action (2026-07-27):** focus-inside subtree reporter; unit + `/focus-within-lab` Playwright. Changeset `runtime-focus-within`. **Uncommitted.**
112. **`download` use-action (2026-07-27):** click-to-save file; unit + `/download-lab` Playwright. Changeset `runtime-download`. **Uncommitted.**
113. **`getAllContexts()` (2026-07-27):** context Map snapshot; unit + `/all-contexts-lab` Playwright. Changeset `runtime-get-all-contexts`. **Uncommitted.**
114. **`fullscreen` use-action (2026-07-27):** click-to-toggle Fullscreen API; unit + `/fullscreen-lab` Playwright. Changeset `runtime-fullscreen`. **Uncommitted.**
115. **`pageTitle()` (2026-07-27):** set/restore `document.title` on mount/destroy; unit + `/page-title-lab` Playwright. Changeset `runtime-page-title`. **Uncommitted.**
116. **`prefersContrast()` (2026-07-27):** `(prefers-contrast: more)` mediaQuery convenience; unit + `/prefers-contrast-lab` Playwright. Changeset `runtime-prefers-contrast`. **Uncommitted.**
117. **Nested component destroy (2026-07-27):** `{#if}`/`{#each}`/`{#key}`/`{#await}` call child `.destroy()` on teardown; unit + `/component-destroy-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
118. **`resize` use-action (2026-07-27):** ResizeObserver size reporter; unit + `/resize-lab` Playwright. Changeset `runtime-resize`. **Uncommitted.**
119. **`swipe` use-action (2026-07-27):** pointer swipe direction; unit + `/swipe-lab` Playwright. Changeset `runtime-swipe`. **Uncommitted.**
120. **`mutate` use-action (2026-07-27):** MutationObserver DOM changes; unit + `/mutate-lab` Playwright. Changeset `runtime-mutate`. **Uncommitted.**
121. **`sticky` use-action (2026-07-27):** stuck-state for position:sticky; unit + `/sticky-lab` Playwright. Changeset `runtime-sticky`. **Uncommitted.**
122. **`drag` use-action (2026-07-27):** pointer drag deltas; unit + `/drag-lab` Playwright. Changeset `runtime-drag`. **Uncommitted.**
123. **`dropzone` use-action (2026-07-27):** file drop target; unit + `/dropzone-lab` Playwright. Changeset `runtime-dropzone`. **Uncommitted.**
124. **`prefersReducedTransparency()` (2026-07-27):** mediaQuery convenience; unit + `/prefers-reduced-transparency-lab` Playwright. Changeset `runtime-prefers-reduced-transparency`. **Uncommitted.**
125. **`tweened()` (2026-07-27):** animated number signal; unit + `/tweened-lab` Playwright. Changeset `runtime-tweened`. **Uncommitted.**
126. **`spring()` (2026-07-27):** spring number signal; unit + `/spring-lab` Playwright. Changeset `runtime-spring`. **Uncommitted.**
127. **`pinch` use-action (2026-07-27):** two-pointer scale; unit + `/pinch-lab` Playwright. Changeset `runtime-pinch`. **Uncommitted.**
128. **Media `bind:played` / `bind:buffered` (2026-07-27):** read TimeRanges end seconds; unit + `/media-played-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
129. **Media `bind:seekable` (2026-07-27):** read seekable TimeRanges end seconds; unit + `/media-seekable-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
130. **Media `bind:networkState` (2026-07-27):** read `HTMLMediaElement.networkState`; unit + `/media-network-state-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
131. **`tooltip` use-action (2026-07-27):** hover/focus tip; unit + `/tooltip-lab` Playwright. Changeset `runtime-tooltip`. **Uncommitted.**
132. **`prefersReducedData()` (2026-07-27):** mediaQuery convenience; unit + `/prefers-reduced-data-lab` Playwright. Changeset `runtime-prefers-reduced-data`. **Uncommitted.**
133. **`transition:spin` (2026-07-27):** rotate+opacity intro/outro (`degrees`/`duration`); also `in:spin` / `out:spin`; unit + `/spin-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
134. **`reveal` use-action (2026-07-27):** viewport class toggle; unit + `/reveal-lab` Playwright. Changeset `runtime-reveal`. **Uncommitted.**
135. **`bind:innerText` (2026-07-27):** contenteditable two-way via `innerText`; unit + `/innertext-bind-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
136. **`lazy` use-action (2026-07-27):** deferred `data-src` → `src` on viewport entry; unit + `/lazy-lab` Playwright. Changeset `runtime-lazy`. **Uncommitted.**
137. **`forcedColors()` (2026-07-27):** mediaQuery convenience; unit + `/forced-colors-lab` Playwright. Changeset `runtime-forced-colors`. **Uncommitted.**
138. **`invertedColors()` (2026-07-27):** mediaQuery convenience; unit + `/inverted-colors-lab` Playwright. Changeset `runtime-inverted-colors`. **Uncommitted.**
139. **`activeElement()` (2026-07-27):** document focus signal; unit + `/active-element-lab` Playwright. Changeset `runtime-active-element`. **Uncommitted.**
140. **`hashSignal()` (2026-07-27):** location.hash signal; unit + `/hash-signal-lab` Playwright. Changeset `runtime-hash-signal`. **Uncommitted.**
141. **`searchParamsSignal()` (2026-07-27):** location.search signal; unit + `/search-params-signal-lab` Playwright. Changeset `runtime-search-params-signal`. **Uncommitted.**
142. **`pathnameSignal()` (2026-07-27):** location.pathname signal; unit + `/pathname-signal-lab` Playwright. Changeset `runtime-pathname-signal`. **Uncommitted.**
143. **`scrollspy` use-action (2026-07-28):** reports most-visible section id; unit + `/scrollspy-lab` Playwright. Changeset `runtime-scrollspy`. **Uncommitted.**
144. **`transition:pop` (2026-07-28):** scale+translateY+opacity intro/outro (`start`/`y`/`duration`); also `in:pop` / `out:pop`; unit + `/pop-lab` Playwright. Folded into `compiler-key-block`. **Uncommitted.**
145. **`focusVisible` use-action (2026-07-28):** `:focus-visible` class + handler; unit + `/focus-visible-lab` Playwright. Changeset `runtime-focus-visible`. **Uncommitted.**
146. **`selectOnFocus` use-action (2026-07-28):** select input/textarea contents on focus; unit + `/select-on-focus-lab` Playwright. Changeset `runtime-select-on-focus`. **Uncommitted.**
147. **`autoHeight` use-action (2026-07-28):** grow textarea to fit content; unit + `/auto-height-lab` Playwright. Changeset `runtime-auto-height`. **Uncommitted.**
148. **`pressed` use-action (2026-07-28):** pointer-down class + handler; unit + `/pressed-lab` Playwright. Changeset `runtime-pressed`. **Uncommitted.**
149. **`infiniteScroll` use-action (2026-07-28):** near-bottom scroll handler; unit + `/infinite-scroll-lab` Playwright. Changeset `runtime-infinite-scroll`. **Uncommitted.**
150. **`holdRepeat` use-action (2026-07-28):** fire + repeat while pointer held; unit + `/hold-repeat-lab` Playwright. Changeset `runtime-hold-repeat`. **Uncommitted.**
151. **`documentTitleSignal()` (2026-07-28):** document.title signal; unit + `/document-title-signal-lab` Playwright. Changeset `runtime-document-title-signal`. **Uncommitted.**
152. **`saveDataSignal()` (2026-07-28):** navigator.connection.saveData signal; unit + `/save-data-signal-lab` Playwright. Changeset `runtime-save-data-signal`. **Uncommitted.**
153. **`htmlLangSignal()` (2026-07-28):** documentElement.lang signal; unit + `/html-lang-signal-lab` Playwright. Changeset `runtime-html-lang-signal`. **Uncommitted.**
154. **`searchParamsSignal` history patch (2026-07-28):** also syncs on patched `pushState`/`replaceState` (not only `popstate`); unit + lab History button Playwright. Changeset `runtime-search-params-history`. **Uncommitted.**
155. **`debounce` use-action (2026-07-28):** debounced input handler; unit + `/debounce-lab` Playwright. Changeset `runtime-debounce`. **Uncommitted.**
156. **`throttle` use-action (2026-07-28):** throttled input handler; unit + `/throttle-lab` Playwright. Changeset `runtime-throttle`. **Uncommitted.**
157. **`connectionEffectiveType()` (2026-07-28):** navigator.connection.effectiveType signal; unit + `/connection-effective-type-lab` Playwright. Changeset `runtime-connection-effective-type`. **Uncommitted.**
158. **`htmlDirSignal()` (2026-07-28):** documentElement.dir signal; unit + `/html-dir-signal-lab` Playwright. Changeset `runtime-html-dir-signal`. **Uncommitted.**
159. **`paste` use-action (2026-07-28):** paste plain-text handler; unit + `/paste-lab` Playwright. Changeset `runtime-paste`. **Uncommitted.**
160. **`connectionDownlink()` (2026-07-28):** navigator.connection.downlink signal; unit + `/connection-downlink-lab` Playwright. Changeset `runtime-connection-downlink`. **Uncommitted.**
161. **`connectionRtt()` (2026-07-28):** navigator.connection.rtt signal; unit + `/connection-rtt-lab` Playwright. Changeset `runtime-connection-rtt`. **Uncommitted.**
162. **`cut` use-action (2026-07-28):** cut plain-text handler (+ selection fallback); unit + `/cut-lab` Playwright. Changeset `runtime-cut`. **Uncommitted.**
163. **`nowSignal()` (2026-07-28):** Date.now() ticking signal; unit + `/now-signal-lab` Playwright. Changeset `runtime-now-signal`. **Uncommitted.**
164. **`keydown` use-action (2026-07-28):** element-scoped hotkey; unit + `/keydown-lab` Playwright. Changeset `runtime-keydown`. **Uncommitted.**
165. **`scrollIntoView` use-action (2026-07-28):** scroll element into view when enabled; unit + `/scroll-into-view-lab` Playwright. Changeset `runtime-scroll-into-view`. **Uncommitted.**
166. **`idleSignal()` (2026-07-28):** idle-after-timeout signal; unit + `/idle-signal-lab` Playwright. Changeset `runtime-idle-signal`. **Uncommitted.**
167. **`keyup` use-action (2026-07-28):** element-scoped key release handler; unit + `/keyup-lab` Playwright. Changeset `runtime-keyup`. **Uncommitted.**
168. **`localeSignal()` (2026-07-28):** `navigator.language` signal; unit + `/locale-signal-lab` Playwright. Changeset `runtime-locale-signal`. **Uncommitted.**
169. **`localesSignal()` (2026-07-28):** `navigator.languages` signal; unit + `/locales-signal-lab` Playwright. Changeset `runtime-locales-signal`. **Uncommitted.**
170. **`timeZoneSignal()` (2026-07-28):** host IANA time zone signal; unit + `/time-zone-signal-lab` Playwright. Changeset `runtime-time-zone-signal`. **Uncommitted.**
171. **`transition:bounce` (2026-07-28):** scale+opacity springy intro/outro; also `in:bounce` / `out:bounce`; unit + `/bounce-lab` Playwright. Changeset `compiler-transition-bounce`. **Uncommitted.**
172. **`dblclick` use-action (2026-07-28):** double-click handler; unit + `/dblclick-lab` Playwright. Changeset `runtime-dblclick`. **Uncommitted.**
173. **`contextmenu` use-action (2026-07-28):** context-menu handler (preventDefault default); unit + `/contextmenu-lab` Playwright. Changeset `runtime-contextmenu`. **Uncommitted.**
174. **`wheel` use-action (2026-07-28):** wheel/trackpad handler; unit + `/wheel-lab` Playwright. Changeset `runtime-wheel`. **Uncommitted.**
175. **`hardwareConcurrencySignal()` (2026-07-28):** navigator.hardwareConcurrency signal; unit + `/hardware-concurrency-lab` Playwright. Changeset `runtime-hardware-concurrency-signal`. **Uncommitted.**
176. **`maxTouchPointsSignal()` (2026-07-28):** navigator.maxTouchPoints signal; unit + `/max-touch-points-lab` Playwright. Changeset `runtime-max-touch-points-signal`. **Uncommitted.**
177. **`scroll` use-action (2026-07-28):** element scrollLeft/scrollTop reporter; unit + `/scroll-lab` Playwright. Changeset `runtime-scroll`. **Uncommitted.**
178. **`snap` use-action (2026-07-28):** CSS scroll-snap helper; unit + `/snap-lab` Playwright. Changeset `runtime-snap`. **Uncommitted.**
179. **`cookieEnabledSignal()` (2026-07-28):** navigator.cookieEnabled signal; unit + `/cookie-enabled-lab` Playwright. Changeset `runtime-cookie-enabled-signal`. **Uncommitted.**
180. **`transition:drop` (2026-07-28):** scale+translateY settle from above; also `in:drop` / `out:drop`; unit + `/drop-lab` Playwright. Changeset `compiler-transition-drop`. **Uncommitted.**
181. **`pdfViewerEnabledSignal()` (2026-07-28):** navigator.pdfViewerEnabled signal; unit + `/pdf-viewer-enabled-lab` Playwright. Changeset `runtime-pdf-viewer-enabled-signal`. **Uncommitted.**
182. **`webdriverSignal()` (2026-07-28):** navigator.webdriver signal; unit + `/webdriver-lab` Playwright. Changeset `runtime-webdriver-signal`. **Uncommitted.**
183. **`beforeinput` use-action (2026-07-28):** beforeinput InputEvent handler; unit + `/beforeinput-lab` Playwright. Changeset `runtime-beforeinput`. **Uncommitted.**
184. **`composition` use-action (2026-07-28):** IME composition start/update/end; unit + `/composition-lab` Playwright. Changeset `runtime-composition`. **Uncommitted.**
185. **`selectionchange` use-action (2026-07-28):** input/textarea selection reporter; unit + `/selectionchange-lab` Playwright. Changeset `runtime-selectionchange`. **Uncommitted.**
186. **`focus` use-action (2026-07-28):** element focus/blur reporter; unit + `/focus-lab` Playwright. Changeset `runtime-focus`. **Uncommitted.**
187. **`transition:slideX` (2026-07-28):** horizontal width+opacity slide; also `in:slideX` / `out:slideX`; unit + `/slidex-lab` Playwright. Changeset `compiler-transition-slidex`. **Uncommitted.**
188. **`storageEstimateSignal()` (2026-07-28):** navigator.storage.estimate signal; unit + `/storage-estimate-lab` Playwright. Changeset `runtime-storage-estimate-signal`. **Uncommitted.**
189. **`storagePersistedSignal()` (2026-07-28):** navigator.storage.persisted signal; unit + `/storage-persisted-lab` Playwright. Changeset `runtime-storage-persisted-signal`. **Uncommitted.**
190. **`change` use-action (2026-07-28):** committed change-event value handler; unit + `/change-lab` Playwright. Changeset `runtime-change`. **Uncommitted.**
191. **`input` use-action (2026-07-28):** live input-event value handler; unit + `/input-lab` Playwright. Changeset `runtime-input`. **Uncommitted.**
192. **`submit` use-action (2026-07-28):** form submit FormData handler; unit + `/submit-lab` Playwright. Changeset `runtime-submit`. **Uncommitted.**
193. **`reset` use-action (2026-07-28):** form reset event handler; unit + `/reset-lab` Playwright. Changeset `runtime-reset`. **Uncommitted.**
194. **`transition:shake` (2026-07-28):** translateX attention intro/outro; also `in:shake` / `out:shake`; unit + `/shake-lab` Playwright. Changeset `compiler-transition-shake`. **Uncommitted.**
195. **`invalid` use-action (2026-07-28):** constraint-validation invalid handler; unit + `/invalid-lab` Playwright. Changeset `runtime-invalid`. **Uncommitted.**
196. **`transition:flip` (2026-07-28):** perspective + rotateY intro/outro; also `in:flip` / `out:flip`; unit + `/flip-lab` Playwright. Changeset `compiler-transition-flip`. **Uncommitted.**
197. **`deviceMemorySignal` (2026-07-28):** `navigator.deviceMemory` GiB approx; unit + `/device-memory-lab` Playwright. Changeset `runtime-device-memory-signal`. **Uncommitted.**
198. **`transition:pulse` (2026-07-28):** overscale attention intro/outro; also `in:pulse` / `out:pulse`; unit + `/pulse-lab` Playwright. Changeset `compiler-transition-pulse`. **Uncommitted.**
199. **`formdata` use-action (2026-07-28):** form `formdata` event to tweak FormData; unit + `/formdata-lab` Playwright. Changeset `runtime-formdata`. **Uncommitted.**
200. **`userAgentSignal` (2026-07-28):** `navigator.userAgent`; unit + `/user-agent-lab` Playwright. Changeset `runtime-user-agent-signal`. **Uncommitted.**
201. **`doNotTrackSignal` (2026-07-28):** normalized `navigator.doNotTrack`; unit + `/do-not-track-lab` Playwright. Changeset `runtime-do-not-track-signal`. **Uncommitted.**
202. **`transition:wipe` (2026-07-28):** clip-path wipe intro/outro (`axis` left/right/up/down); also `in:wipe` / `out:wipe`; unit + `/wipe-lab` Playwright. Changeset `compiler-transition-wipe`. **Uncommitted.**
203. **`transition:skew` (2026-07-28):** skewX/Y + opacity intro/outro; also `in:skew` / `out:skew`; unit + `/skew-lab` Playwright. Changeset `compiler-transition-skew`. **Uncommitted.**
204. **`vendorSignal` (2026-07-28):** `navigator.vendor`; unit + `/vendor-lab` Playwright. Changeset `runtime-vendor-signal`. **Uncommitted.**
205. **`transition:roll` (2026-07-28):** perspective + rotateX intro/outro; also `in:roll` / `out:roll`; unit + `/roll-lab` Playwright. Changeset `compiler-transition-roll`. **Uncommitted.**
206. **`appVersionSignal` (2026-07-28):** `navigator.appVersion`; unit + `/app-version-lab` Playwright. Changeset `runtime-app-version-signal`. **Uncommitted.**
207. **`productSignal` (2026-07-28):** `navigator.product`; unit + `/product-lab` Playwright. Changeset `runtime-product-signal`. **Uncommitted.**
208. **`transition:zoom` (2026-07-28):** scale zoom intro/outro (start 0.5, ease-out); also `in:zoom` / `out:zoom`; unit + `/zoom-lab` Playwright. Changeset `compiler-transition-zoom`. **Uncommitted.**
209. **`trim` use-action (2026-07-28):** trim input/textarea on blur; unit + `/trim-lab` Playwright. Changeset `runtime-trim`. **Uncommitted.**
210. **`numeric` use-action (2026-07-28):** keep only digits while typing; unit + `/numeric-lab` Playwright. Changeset `runtime-numeric`. **Uncommitted.**
211. **`lowercase` use-action (2026-07-28):** lowercase on blur; unit + `/lowercase-lab` Playwright. Changeset `runtime-lowercase`. **Uncommitted.**
212. **`uppercase` use-action (2026-07-28):** uppercase on blur; unit + `/uppercase-lab` Playwright. Changeset `runtime-uppercase`. **Uncommitted.**
213. **`alphanumeric` use-action (2026-07-28):** letters+digits while typing; unit + `/alphanumeric-lab` Playwright. Changeset `runtime-alphanumeric`. **Uncommitted.**
214. **`slugify` use-action (2026-07-28):** URL slug on blur; unit + `/slugify-lab` Playwright. Changeset `runtime-slugify`. **Uncommitted.**
215. **`capitalize` use-action (2026-07-28):** title-case words on blur; unit + `/capitalize-lab` Playwright. Changeset `runtime-capitalize`. **Uncommitted.**
216. **`maxLength` use-action (2026-07-28):** clamp input length while typing; unit + `/max-length-lab` Playwright. Changeset `runtime-max-length`. **Uncommitted.**
217. **`appNameSignal` (2026-07-28):** `navigator.appName`; unit + `/app-name-lab` Playwright. Changeset `runtime-app-name-signal`. **Uncommitted.**
218. **`platformSignal` (2026-07-28):** `navigator.platform`; unit + `/platform-lab` Playwright. Changeset `runtime-platform-signal`. **Uncommitted.**
219. **`appCodeNameSignal` (2026-07-28):** `navigator.appCodeName`; unit + `/app-code-name-lab` Playwright. Changeset `runtime-app-code-name-signal`. **Uncommitted.**
220. **`decimal` use-action (2026-07-28):** digits + one decimal point while typing; unit + `/decimal-lab` Playwright. Changeset `runtime-decimal`. **Uncommitted.**
221. **`hex` use-action (2026-07-28):** optional # + hex digits while typing; unit + `/hex-lab` Playwright. Changeset `runtime-hex`. **Uncommitted.**
222. **`integer` use-action (2026-07-28):** optional - + digits while typing; unit + `/integer-lab` Playwright. Changeset `runtime-integer`. **Uncommitted.**
223. **`signedDecimal` use-action (2026-07-28):** optional - + digits + one `.` while typing; unit + `/signed-decimal-lab` Playwright. Changeset `runtime-signed-decimal`. **Uncommitted.**
224. **`phone` use-action (2026-07-28):** phone-friendly chars while typing; unit + `/phone-lab` Playwright. Changeset `runtime-phone`. **Uncommitted.**
225. **`email` use-action (2026-07-28):** email-friendly chars + lowercase while typing; unit + `/email-lab` Playwright. Changeset `runtime-email`. **Uncommitted.**
226. **`url` use-action (2026-07-28):** URL-friendly chars while typing; unit + `/url-lab` Playwright. Changeset `runtime-url`. **Uncommitted.**
227. **`username` use-action (2026-07-28):** handle-friendly chars + lowercase while typing; unit + `/username-lab` Playwright. Changeset `runtime-username`. **Uncommitted.**
228. **`creditCard` use-action (2026-07-28):** digits/spaces/hyphens while typing; unit + `/credit-card-lab` Playwright. Changeset `runtime-credit-card`. **Uncommitted.**
229. **`postalCode` use-action (2026-07-28):** postal chars + uppercase while typing; unit + `/postal-code-lab` Playwright. Changeset `runtime-postal-code`. **Uncommitted.**
230. **`iban` use-action (2026-07-28):** IBAN chars + uppercase while typing; unit + `/iban-lab` Playwright. Changeset `runtime-iban`. **Uncommitted.**
231. **`cvv` use-action (2026-07-28):** up to 4 digits while typing; unit + `/cvv-lab` Playwright. Changeset `runtime-cvv`. **Uncommitted.**
232. **`otp` use-action (2026-07-28):** up to 6 digits while typing; unit + `/otp-lab` Playwright. Changeset `runtime-otp`. **Uncommitted.**
233. **`collapseWhitespace` use-action (2026-07-28):** collapse whitespace + trim on blur; unit + `/collapse-whitespace-lab` Playwright. Changeset `runtime-collapse-whitespace`. **Uncommitted.**
234. **`removeWhitespace` use-action (2026-07-28):** strip all whitespace on blur; unit + `/remove-whitespace-lab` Playwright. Changeset `runtime-remove-whitespace`. **Uncommitted.**
235. **`expiry` use-action (2026-07-28):** MM/YY card expiry while typing; unit + `/expiry-lab` Playwright. Changeset `runtime-expiry`. **Uncommitted.**
236. **`letters` use-action (2026-07-28):** letters-only while typing; unit + `/letters-lab` Playwright. Changeset `runtime-letters`. **Uncommitted.**
237. **`pin` use-action (2026-07-28):** up to 4 digits while typing; unit + `/pin-lab` Playwright. Changeset `runtime-pin`. **Uncommitted.**
238. **`ascii` use-action (2026-07-28):** printable ASCII while typing; unit + `/ascii-lab` Playwright. Changeset `runtime-ascii`. **Uncommitted.**
239. **`currency` use-action (2026-07-28):** optional $ + digits + one `.` while typing; unit + `/currency-lab` Playwright. Changeset `runtime-currency`. **Uncommitted.**
240. **`percent` use-action (2026-07-28):** digits + one `.` + optional `%` while typing; unit + `/percent-lab` Playwright. Changeset `runtime-percent`. **Uncommitted.**
241. **`removePunct` use-action (2026-07-28):** strip punctuation while typing; unit + `/remove-punct-lab` Playwright. Changeset `runtime-remove-punct`. **Uncommitted.**
242. **`removeDiacritics` use-action (2026-07-28):** strip accent marks while typing; unit + `/remove-diacritics-lab` Playwright. Changeset `runtime-remove-diacritics`. **Uncommitted.**
243. **`trimStart` use-action (2026-07-28):** trim leading whitespace on blur; unit + `/trim-start-lab` Playwright. Changeset `runtime-trim-start`. **Uncommitted.**
244. **`trimEnd` use-action (2026-07-28):** trim trailing whitespace on blur; unit + `/trim-end-lab` Playwright. Changeset `runtime-trim-end`. **Uncommitted.**
245. **`initials` use-action (2026-07-28):** turn words into initials on blur; unit + `/initials-lab` Playwright. Changeset `runtime-initials`. **Uncommitted.**
246. **`sentenceCase` use-action (2026-07-28):** first letter upper, rest lower on blur; unit + `/sentence-case-lab` Playwright. Changeset `runtime-sentence-case`. **Uncommitted.**
247. **`camelCase` use-action (2026-07-28):** words to camelCase on blur; unit + `/camel-case-lab` Playwright. Changeset `runtime-camel-case`. **Uncommitted.**
248. **`snakeCase` use-action (2026-07-28):** words to snake_case on blur; unit + `/snake-case-lab` Playwright. Changeset `runtime-snake-case`. **Uncommitted.**
249. **`kebabCase` use-action (2026-07-28):** words to kebab-case on blur; unit + `/kebab-case-lab` Playwright. Changeset `runtime-kebab-case`. **Uncommitted.**
250. **`constantCase` use-action (2026-07-28):** words to CONSTANT_CASE on blur; unit + `/constant-case-lab` Playwright. Changeset `runtime-constant-case`. **Uncommitted.**
251. **`pascalCase` use-action (2026-07-28):** words to PascalCase on blur; unit + `/pascal-case-lab` Playwright. Changeset `runtime-pascal-case`. **Uncommitted.**
252. **`dotCase` use-action (2026-07-28):** words to dot.case on blur; unit + `/dot-case-lab` Playwright. Changeset `runtime-dot-case`. **Uncommitted.**
253. **`pathCase` use-action (2026-07-28):** words to path/case on blur; unit + `/path-case-lab` Playwright. Changeset `runtime-path-case`. **Uncommitted.**
254. **`trainCase` use-action (2026-07-28):** words to Train-Case on blur; unit + `/train-case-lab` Playwright. Changeset `runtime-train-case`. **Uncommitted.**
255. **`swapCase` use-action (2026-07-28):** invert letter casing on blur; unit + `/swap-case-lab` Playwright. Changeset `runtime-swap-case`. **Uncommitted.**
256. **`reverse` use-action (2026-07-28):** reverse the current value on blur; unit + `/reverse-lab` Playwright. Changeset `runtime-reverse`. **Uncommitted.**


## Domain öncesi gap listesi (2026-07-26)

**Sahte / yarı-gerçek:**
- `hydrate` = soft rebuild (`mount` → `replaceChildren`), gerçek DOM reuse yok
- ~~client nav `#app.innerHTML` swap~~ **düzeltildi (2026-07-26):** `moveChildNodes` → `replaceChildren` (uncommitted, changeset `runtime-nav-replace-children`)
- Child bileşenler client'ta hep `.mount()` (hydrate yolunda da)
- ~~README/CONTRIBUTING hâlâ adapter'ları "stub" diyor~~ **düzeltildi**
- www: `nodeAdapter` + Pages'e sadece `build/client` — CF adapter dogfood yok
- ORM scaffold: config stub only (bilinçli)
- ~~`asUiComponent` auto-wire yok (manuel/opsiyonel)~~ **yapıldı (2026-07-26):** vite-plugin `routes.ts` import setine bakarak non-route `.ave` → `asUiComponent: true` (uncommitted, changeset `vite-plugin-as-ui-auto`)

**Önemli açıklar (launch güvenilirliği):**
- ~~Composition + head npm changeset~~ **yayınlandı** (`avedon@0.1.4`, compiler/server/shared `0.2.0`)
- ~~Sitemap/robots / OG absolute~~ **hazır** (`AVEDON_DOCS_ORIGIN`, default pages.dev; Pages Variable `AVEDON_DOCS_ORIGIN`)
- CF adapter: ISR yok (dokümante)
- `.ave` language service / LSP yok

**Kabul edilebilir post-v1:** other transitions beyond fade/fly/slide/scale/blur, on-demand ISR
- ~~`{#key}`~~ **landed (2026-07-26)** — remount on expression change; changeset `compiler-key-block`
- ~~keyed each~~ **landed (2026-07-26)** — keyed DOM reconciliation; same changeset
- ~~named slots~~ **landed (2026-07-26)** — `slots` prop bag; same changeset
- ~~`class:`~~ **landed (2026-07-26)** — element class toggles; same changeset
- ~~`style:`~~ **landed (2026-07-26)** — element style properties; same changeset
- ~~`bind:checked`~~ **landed (2026-07-26)** — checkbox two-way bind; same changeset
- ~~event dispatcher~~ **landed (2026-07-26)** — `createEventDispatcher`; changeset `runtime-event-dispatcher`
- ~~`use:`~~ **landed (2026-07-26)** — element actions; same compiler changeset
- ~~`bind:this`~~ **landed (2026-07-26)** — element refs; same compiler changeset
- ~~`bind:group`~~ **landed (2026-07-26)** — radio + checkbox arrays; same compiler changeset
- ~~`transition:fade`~~ **landed (2026-07-26)** — intro fade; same compiler changeset
- ~~`onMount` / `onDestroy`~~ **landed (2026-07-26)** — changeset `runtime-lifecycle`
- ~~`{:else if}`~~ **landed (2026-07-26)** — flattened client emit; same compiler changeset
- ~~`{#each} {:else}`~~ **landed (2026-07-27)** — empty list branch; same compiler changeset
- ~~`{@const}`~~ **landed (2026-07-27)** — sibling-scoped locals; same compiler changeset
- ~~`{#await}` pending~~ **landed (2026-07-27)** — pending UI before then/catch; changeset `await-pending`
- ~~event modifiers~~ **landed (2026-07-27)** — including `passive` + `stopImmediatePropagation`; same compiler changeset
- ~~HTML comments~~ **landed (2026-07-27)** — `<!-- -->` stripped at compile; same compiler changeset
- ~~`{#await} then/catch shorthand`~~ **landed (2026-07-27)** — `{#await p then v}` / `catch e`; same compiler changeset
- ~~boolean attrs~~ **landed (2026-07-27)** — `disabled={…}` omits when falsy; same compiler changeset
- ~~`<select bind:value>`~~ **landed (2026-07-27)** — change + SSR selected options; same compiler changeset
- ~~`transition:fade` outro~~ **landed (2026-07-27)** — `{#if}` / `{#each}` including keyed; same compiler changeset
- ~~`transition:fly`~~ **landed (2026-07-27)** — translate+opacity; same compiler changeset
- ~~`in:` / `out:`~~ **landed (2026-07-27)** — intro-only / outro-only fade|fly; same compiler changeset
- ~~`transition:slide`~~ **landed (2026-07-27)** — height+opacity; same compiler changeset
- ~~`transition:scale`~~ **landed (2026-07-27)** — scale+opacity (`start`); same compiler changeset
- ~~spread attributes~~ **landed (2026-07-27)** — element `{...obj}` + component prop spreads; same compiler changeset
- ~~`bind:files`~~ **landed (2026-07-27)** — file input FileList binding; same compiler changeset
- ~~`transition:blur`~~ **landed (2026-07-27)** — filter blur+opacity (`amount`); same compiler changeset
- ~~dimension binds~~ **landed (2026-07-27)** — clientWidth/Height + offsetWidth/Height; same compiler changeset
- ~~`bind:scrollTop` / `scrollLeft`~~ **landed (2026-07-27)** — two-way scroll; same compiler changeset
- ~~`bind:indeterminate`~~ **landed (2026-07-27)** — checkbox IDL; same compiler changeset
- ~~`bind:open`~~ **landed (2026-07-27)** — details/dialog open; same compiler changeset
- ~~`bind:muted` / `paused`~~ **landed (2026-07-27)** — media element binds; same compiler changeset
- ~~`bind:volume` / `currentTime`~~ **landed (2026-07-27)** — media volume/seek; same compiler changeset
- ~~`bind:playbackRate` / `duration`~~ **landed (2026-07-27)** — media rate + duration; same compiler changeset
- ~~`bind:textContent`~~ **landed (2026-07-27)** — contenteditable text; same compiler changeset
- ~~`transition:draw` + SVG NS~~ **landed (2026-07-27)** — SVG stroke draw + createElementNS; same compiler changeset
- ~~`nonpassive`~~ **landed (2026-07-27)** — `{ passive: false }` listener option; same compiler changeset
- ~~numeric `bind:value`~~ **landed (2026-07-27)** — number/range → `valueAsNumber`; same compiler changeset
- ~~multi-select `bind:value`~~ **landed (2026-07-27)** — `<select multiple>` ↔ `string[]`; same compiler changeset
- ~~transition `delay`~~ **landed (2026-07-27)** — CSS delay on all built-in transitions; same compiler changeset
- ~~transition `easing`~~ **landed (2026-07-27)** — CSS timing-function option; same compiler changeset
- ~~`tick()`~~ **landed (2026-07-27)** — runtime Promise after DOM flush; changeset `runtime-tick`
- ~~`untrack()`~~ **landed (2026-07-27)** — sample signals without effect deps; changeset `runtime-untrack`
- ~~context API~~ **landed (2026-07-27)** — setContext/getContext/hasContext; changeset `runtime-context`
- ~~`beforeUpdate` / `afterUpdate`~~ **landed (2026-07-27)** — update lifecycle hooks; changeset `runtime-update-hooks`
- ~~`mediaQuery()`~~ **landed (2026-07-27)** — matchMedia read-only signal; changeset `runtime-media-query`
- ~~`persistedSignal()`~~ **landed (2026-07-27)** — localStorage JSON signal; changeset `runtime-persisted-signal`
- ~~`onlineSignal()`~~ **landed (2026-07-27)** — navigator.onLine signal; changeset `runtime-online-signal`
- ~~`visibilitySignal()`~~ **landed (2026-07-27)** — document.visibilityState signal; changeset `runtime-visibility-signal`
- ~~`persistedSignal` session option~~ **landed (2026-07-27)** — `{ storage: 'session' }`; same persisted-signal changeset
- ~~soft hydrate focus restore~~ **landed (2026-07-27)** — capture/restore focus on remount; changeset `runtime-soft-hydrate-focus`
- ~~soft hydrate form restore~~ **landed (2026-07-27)** — capture/restore input values; changeset `runtime-soft-hydrate-form`
- ~~soft hydrate scroll restore~~ **landed (2026-07-27)** — capture/restore element + window scroll; changeset `runtime-soft-hydrate-scroll`
- ~~`batch()`~~ **landed (2026-07-27)** — coalesce signal effect notifications; changeset `runtime-batch`
- ~~soft hydrate open restore~~ **landed (2026-07-27)** — details/dialog open IDL; changeset `runtime-soft-hydrate-open`
- ~~`windowSize()`~~ **landed (2026-07-27)** — innerWidth/innerHeight signal; changeset `runtime-window-size`
- ~~`pageScroll()`~~ **landed (2026-07-27)** — scrollX/scrollY signal; changeset `runtime-page-scroll`
- ~~media `bind:ended` / `bind:seeking`~~ **landed (2026-07-27)** — read from element events; folded into `compiler-key-block`
- ~~media `bind:readyState`~~ **landed (2026-07-27)** — HTMLMediaElement.readyState; folded into `compiler-key-block`
- ~~media `bind:videoWidth` / `videoHeight`~~ **landed (2026-07-27)** — video metrics; folded into `compiler-key-block`
- ~~`readonly()`~~ **landed (2026-07-27)** — read-only signal wrapper; changeset `runtime-readonly`
- ~~image `bind:naturalWidth` / `naturalHeight`~~ **landed (2026-07-27)** — img metrics; folded into `compiler-key-block`
- ~~`devicePixelRatio()`~~ **landed (2026-07-27)** — window.devicePixelRatio signal; changeset `runtime-device-pixel-ratio`
- ~~`style:--*` CSS variables~~ **landed (2026-07-27)** — custom properties; lab + docs; folded into `compiler-key-block`
- ~~`portal` use-action~~ **landed (2026-07-27)** — reparent into host; changeset `runtime-portal`
- ~~`clickOutside` use-action~~ **landed (2026-07-27)** — outside pointerdown handler; changeset `runtime-click-outside`
- ~~`focusTrap` use-action~~ **landed (2026-07-27)** — Tab trap + autofocus; changeset `runtime-focus-trap`
- ~~`lockScroll` use-action~~ **landed (2026-07-27)** — document overflow lock; changeset `runtime-lock-scroll`
- ~~`escapeKey` use-action~~ **landed (2026-07-27)** — Escape handler; changeset `runtime-escape-key`
- ~~`inView` use-action~~ **landed (2026-07-27)** — IntersectionObserver; changeset `runtime-in-view`
- ~~`prefersReducedMotion()`~~ **landed (2026-07-27)** — reduced-motion mediaQuery helper; changeset `runtime-prefers-reduced-motion`
- ~~`hotkey` use-action~~ **landed (2026-07-27)** — document key shortcuts; changeset `runtime-hotkey`
- ~~reduced-motion transitions~~ **landed (2026-07-27)** — `transitionMs` zeros timing; changeset `runtime-transition-ms`
- ~~`bind:selectionStart` / `selectionEnd`~~ **landed (2026-07-27)** — caret range binds; folded into `compiler-key-block`
- ~~`prefersColorScheme()`~~ **landed (2026-07-27)** — light/dark preference signal; changeset `runtime-prefers-color-scheme`
- ~~`longPress` use-action~~ **landed (2026-07-27)** — hold pointer handler; changeset `runtime-long-press`
- ~~`autofocus` use-action~~ **landed (2026-07-27)** — focus after mount; changeset `runtime-autofocus`
- ~~`copy` use-action~~ **landed (2026-07-27)** — clipboard write on click; changeset `runtime-copy`
- ~~`hover` use-action~~ **landed (2026-07-27)** — pointer enter/leave; changeset `runtime-hover`
- ~~`focusWithin` use-action~~ **landed (2026-07-27)** — focus-inside subtree; changeset `runtime-focus-within`
- ~~`download` use-action~~ **landed (2026-07-27)** — click-to-save file; changeset `runtime-download`
- ~~`getAllContexts()`~~ **landed (2026-07-27)** — context Map snapshot; changeset `runtime-get-all-contexts`
- ~~`fullscreen` use-action~~ **landed (2026-07-27)** — click-to-toggle Fullscreen API; changeset `runtime-fullscreen`
- ~~`pageTitle()`~~ **landed (2026-07-27)** — set/restore document.title; changeset `runtime-page-title`
- ~~`prefersContrast()`~~ **landed (2026-07-27)** — contrast mediaQuery helper; changeset `runtime-prefers-contrast`
- ~~nested component destroy on block teardown~~ **landed (2026-07-27)** — `{#if}`/`{#each}`/`{#key}`/`{#await}` call `.destroy()`; folded into `compiler-key-block`
- ~~`resize` use-action~~ **landed (2026-07-27)** — ResizeObserver reporter; changeset `runtime-resize`
- ~~`swipe` use-action~~ **landed (2026-07-27)** — pointer swipe direction; changeset `runtime-swipe`
- ~~`mutate` use-action~~ **landed (2026-07-27)** — MutationObserver; changeset `runtime-mutate`
- ~~`sticky` use-action~~ **landed (2026-07-27)** — stuck-state for position:sticky; changeset `runtime-sticky`
- ~~`drag` use-action~~ **landed (2026-07-27)** — pointer drag deltas; changeset `runtime-drag`
- ~~`dropzone` use-action~~ **landed (2026-07-27)** — file drop target; changeset `runtime-dropzone`
- ~~`prefersReducedTransparency()`~~ **landed (2026-07-27)** — reduced-transparency mediaQuery helper; changeset `runtime-prefers-reduced-transparency`
- ~~`tweened()`~~ **landed (2026-07-27)** — animated number signal; changeset `runtime-tweened`
- ~~`spring()`~~ **landed (2026-07-27)** — spring number signal; changeset `runtime-spring`
- ~~`pinch` use-action~~ **landed (2026-07-27)** — two-pointer scale; changeset `runtime-pinch`
- ~~media `bind:played` / `bind:buffered`~~ **landed (2026-07-27)** — TimeRanges end seconds; folded into `compiler-key-block`
- ~~media `bind:seekable`~~ **landed (2026-07-27)** — seekable TimeRanges end; folded into `compiler-key-block`
- ~~media `bind:networkState`~~ **landed (2026-07-27)** — HTMLMediaElement.networkState; folded into `compiler-key-block`
- ~~`tooltip` use-action~~ **landed (2026-07-27)** — hover/focus tip; changeset `runtime-tooltip`
- ~~`prefersReducedData()`~~ **landed (2026-07-27)** — reduced-data mediaQuery helper; changeset `runtime-prefers-reduced-data`
- ~~`transition:spin`~~ **landed (2026-07-27)** — rotate+opacity; folded into `compiler-key-block`
- ~~`reveal` use-action~~ **landed (2026-07-27)** — viewport class toggle; changeset `runtime-reveal`
- ~~`bind:innerText`~~ **landed (2026-07-27)** — contenteditable innerText bind; folded into `compiler-key-block`
- ~~`lazy` use-action~~ **landed (2026-07-27)** — deferred data-src→src; changeset `runtime-lazy`
- ~~`forcedColors()`~~ **landed (2026-07-27)** — forced-colors mediaQuery helper; changeset `runtime-forced-colors`
- ~~`invertedColors()`~~ **landed (2026-07-27)** — inverted-colors mediaQuery helper; changeset `runtime-inverted-colors`
- ~~`activeElement()`~~ **landed (2026-07-27)** — document focus signal; changeset `runtime-active-element`
- ~~`hashSignal()`~~ **landed (2026-07-27)** — location.hash signal; changeset `runtime-hash-signal`
- ~~`searchParamsSignal()`~~ **landed (2026-07-27)** — location.search signal; changeset `runtime-search-params-signal`
- ~~`pathnameSignal()`~~ **landed (2026-07-27)** — location.pathname signal; changeset `runtime-pathname-signal`
- ~~`scrollspy` use-action~~ **landed (2026-07-28)** — most-visible section id; changeset `runtime-scrollspy`
- ~~`transition:pop`~~ **landed (2026-07-28)** — scale+translateY pop; folded into `compiler-key-block`
- ~~`focusVisible` use-action~~ **landed (2026-07-28)** — `:focus-visible` class/handler; changeset `runtime-focus-visible`
- ~~`selectOnFocus` use-action~~ **landed (2026-07-28)** — select contents on focus; changeset `runtime-select-on-focus`
- ~~`autoHeight` use-action~~ **landed (2026-07-28)** — grow textarea to fit; changeset `runtime-auto-height`
- ~~`pressed` use-action~~ **landed (2026-07-28)** — pointer-down class/handler; changeset `runtime-pressed`
- ~~`infiniteScroll` use-action~~ **landed (2026-07-28)** — near-bottom scroll handler; changeset `runtime-infinite-scroll`
- ~~`holdRepeat` use-action~~ **landed (2026-07-28)** — fire+repeat while held; changeset `runtime-hold-repeat`
- ~~`documentTitleSignal()`~~ **landed (2026-07-28)** — document.title signal; changeset `runtime-document-title-signal`
- ~~`saveDataSignal()`~~ **landed (2026-07-28)** — navigator.connection.saveData; changeset `runtime-save-data-signal`
- ~~`htmlLangSignal()`~~ **landed (2026-07-28)** — documentElement.lang signal; changeset `runtime-html-lang-signal`
- ~~`searchParamsSignal` history patch~~ **landed (2026-07-28)** — sync on push/replaceState; changeset `runtime-search-params-history`
- ~~`debounce` use-action~~ **landed (2026-07-28)** — debounced input handler; changeset `runtime-debounce`
- ~~`throttle` use-action~~ **landed (2026-07-28)** — throttled input handler; changeset `runtime-throttle`
- ~~`connectionEffectiveType()`~~ **landed (2026-07-28)** — connection.effectiveType signal; changeset `runtime-connection-effective-type`
- ~~`htmlDirSignal()`~~ **landed (2026-07-28)** — documentElement.dir signal; changeset `runtime-html-dir-signal`
- ~~`paste` use-action~~ **landed (2026-07-28)** — paste plain-text handler; changeset `runtime-paste`
- ~~`connectionDownlink()`~~ **landed (2026-07-28)** — connection.downlink Mbps; changeset `runtime-connection-downlink`
- ~~`connectionRtt()`~~ **landed (2026-07-28)** — connection.rtt ms; changeset `runtime-connection-rtt`
- ~~`cut` use-action~~ **landed (2026-07-28)** — cut plain-text handler; changeset `runtime-cut`
- ~~`nowSignal()`~~ **landed (2026-07-28)** — Date.now() interval signal; changeset `runtime-now-signal`
- ~~`keydown` use-action~~ **landed (2026-07-28)** — element-scoped hotkey; changeset `runtime-keydown`
- ~~`scrollIntoView` use-action~~ **landed (2026-07-28)** — scroll into view when enabled; changeset `runtime-scroll-into-view`
- ~~`idleSignal()`~~ **landed (2026-07-28)** — idle-after-timeout signal; changeset `runtime-idle-signal`
- ~~`keyup` use-action~~ **landed (2026-07-28)** — element-scoped keyup; changeset `runtime-keyup`
- ~~`localeSignal()`~~ **landed (2026-07-28)** — navigator.language signal; changeset `runtime-locale-signal`
- ~~`localesSignal()`~~ **landed (2026-07-28)** — navigator.languages signal; changeset `runtime-locales-signal`
- ~~`timeZoneSignal()`~~ **landed (2026-07-28)** — host IANA time zone signal; changeset `runtime-time-zone-signal`
- ~~`transition:bounce`~~ **landed (2026-07-28)** — scale+opacity bounce; changeset `compiler-transition-bounce`
- ~~`dblclick` use-action~~ **landed (2026-07-28)** — double-click handler; changeset `runtime-dblclick`
- ~~`contextmenu` use-action~~ **landed (2026-07-28)** — context-menu handler; changeset `runtime-contextmenu`
- ~~`wheel` use-action~~ **landed (2026-07-28)** — wheel/trackpad handler; changeset `runtime-wheel`
- ~~`hardwareConcurrencySignal()`~~ **landed (2026-07-28)** — hardwareConcurrency signal; changeset `runtime-hardware-concurrency-signal`
- ~~`maxTouchPointsSignal()`~~ **landed (2026-07-28)** — maxTouchPoints signal; changeset `runtime-max-touch-points-signal`
- ~~`scroll` use-action~~ **landed (2026-07-28)** — element scrollLeft/scrollTop; changeset `runtime-scroll`
- ~~`snap` use-action~~ **landed (2026-07-28)** — CSS scroll-snap helper; changeset `runtime-snap`
- ~~`cookieEnabledSignal()`~~ **landed (2026-07-28)** — cookieEnabled signal; changeset `runtime-cookie-enabled-signal`
- ~~`transition:drop`~~ **landed (2026-07-28)** — scale+translateY drop; changeset `compiler-transition-drop`
- ~~`pdfViewerEnabledSignal()`~~ **landed (2026-07-28)** — pdfViewerEnabled signal; changeset `runtime-pdf-viewer-enabled-signal`
- ~~`webdriverSignal()`~~ **landed (2026-07-28)** — webdriver signal; changeset `runtime-webdriver-signal`
- ~~`beforeinput` use-action~~ **landed (2026-07-28)** — beforeinput handler; changeset `runtime-beforeinput`
- ~~`composition` use-action~~ **landed (2026-07-28)** — IME composition phases; changeset `runtime-composition`
- ~~`selectionchange` use-action~~ **landed (2026-07-28)** — selection range reporter; changeset `runtime-selectionchange`
- ~~`focus` use-action~~ **landed (2026-07-28)** — element focus/blur; changeset `runtime-focus`
- ~~`transition:slideX`~~ **landed (2026-07-28)** — horizontal width slide; changeset `compiler-transition-slidex`
- ~~`storageEstimateSignal()`~~ **landed (2026-07-28)** — storage.estimate usage/quota; changeset `runtime-storage-estimate-signal`
- ~~`storagePersistedSignal()`~~ **landed (2026-07-28)** — storage.persisted flag; changeset `runtime-storage-persisted-signal`
- ~~`change` use-action~~ **landed (2026-07-28)** — change-event value handler; changeset `runtime-change`
- ~~`input` use-action~~ **landed (2026-07-28)** — live input-event handler; changeset `runtime-input`
- ~~`submit` use-action~~ **landed (2026-07-28)** — form submit FormData handler; changeset `runtime-submit`
- ~~`reset` use-action~~ **landed (2026-07-28)** — form reset handler; changeset `runtime-reset`
- ~~`transition:shake`~~ **landed (2026-07-28)** — translateX shake; changeset `compiler-transition-shake`
- ~~`invalid` use-action~~ **landed (2026-07-28)** — invalid constraint handler; changeset `runtime-invalid`
- ~~`transition:flip`~~ **landed (2026-07-28)** — perspective + rotateY; changeset `compiler-transition-flip`
- ~~`deviceMemorySignal`~~ **landed (2026-07-28)** — navigator.deviceMemory; changeset `runtime-device-memory-signal`
- ~~`transition:pulse`~~ **landed (2026-07-28)** — overscale settle; changeset `compiler-transition-pulse`
- ~~`formdata` use-action~~ **landed (2026-07-28)** — formdata event handler; changeset `runtime-formdata`
- ~~`userAgentSignal`~~ **landed (2026-07-28)** — navigator.userAgent; changeset `runtime-user-agent-signal`
- ~~`doNotTrackSignal`~~ **landed (2026-07-28)** — normalized DNT; changeset `runtime-do-not-track-signal`
- ~~`transition:wipe`~~ **landed (2026-07-28)** — clip-path wipe; changeset `compiler-transition-wipe`
- ~~`transition:skew`~~ **landed (2026-07-28)** — skewX/Y settle; changeset `compiler-transition-skew`
- ~~`vendorSignal`~~ **landed (2026-07-28)** — navigator.vendor; changeset `runtime-vendor-signal`
- ~~`transition:roll`~~ **landed (2026-07-28)** — perspective + rotateX; changeset `compiler-transition-roll`
- ~~`appVersionSignal`~~ **landed (2026-07-28)** — navigator.appVersion; changeset `runtime-app-version-signal`
- ~~`productSignal`~~ **landed (2026-07-28)** — navigator.product; changeset `runtime-product-signal`
- ~~`transition:zoom`~~ **landed (2026-07-28)** — scale zoom ease-out; changeset `compiler-transition-zoom`
- ~~`trim` use-action~~ **landed (2026-07-28)** — trim on blur; changeset `runtime-trim`
- ~~`numeric` use-action~~ **landed (2026-07-28)** — digits-only input; changeset `runtime-numeric`
- ~~`lowercase` use-action~~ **landed (2026-07-28)** — lowercase on blur; changeset `runtime-lowercase`
- ~~`uppercase` use-action~~ **landed (2026-07-28)** — uppercase on blur; changeset `runtime-uppercase`
- ~~`alphanumeric` use-action~~ **landed (2026-07-28)** — letters+digits; changeset `runtime-alphanumeric`
- ~~`slugify` use-action~~ **landed (2026-07-28)** — URL slug on blur; changeset `runtime-slugify`
- ~~`capitalize` use-action~~ **landed (2026-07-28)** — title-case on blur; changeset `runtime-capitalize`
- ~~`maxLength` use-action~~ **landed (2026-07-28)** — clamp length; changeset `runtime-max-length`
- ~~`appNameSignal`~~ **landed (2026-07-28)** — navigator.appName; changeset `runtime-app-name-signal`
- ~~`platformSignal`~~ **landed (2026-07-28)** — navigator.platform; changeset `runtime-platform-signal`
- ~~`appCodeNameSignal`~~ **landed (2026-07-28)** — navigator.appCodeName; changeset `runtime-app-code-name-signal`
- ~~`decimal` use-action~~ **landed (2026-07-28)** — decimal input filter; changeset `runtime-decimal`
- ~~`hex` use-action~~ **landed (2026-07-28)** — hex color input filter; changeset `runtime-hex`
- ~~`integer` use-action~~ **landed (2026-07-28)** — signed integer input filter; changeset `runtime-integer`
- ~~`signedDecimal` use-action~~ **landed (2026-07-28)** — signed decimal input filter; changeset `runtime-signed-decimal`
- ~~`phone` use-action~~ **landed (2026-07-28)** — phone input filter; changeset `runtime-phone`
- ~~`email` use-action~~ **landed (2026-07-28)** — email input filter; changeset `runtime-email`
- ~~`url` use-action~~ **landed (2026-07-28)** — URL input filter; changeset `runtime-url`
- ~~`username` use-action~~ **landed (2026-07-28)** — username/handle input filter; changeset `runtime-username`
- ~~`creditCard` use-action~~ **landed (2026-07-28)** — credit card input filter; changeset `runtime-credit-card`
- ~~`postalCode` use-action~~ **landed (2026-07-28)** — postal code input filter; changeset `runtime-postal-code`
- ~~`iban` use-action~~ **landed (2026-07-28)** — IBAN input filter; changeset `runtime-iban`
- ~~`cvv` use-action~~ **landed (2026-07-28)** — CVV/CVC digit filter (max 4); changeset `runtime-cvv`
- ~~`otp` use-action~~ **landed (2026-07-28)** — OTP digit filter (max 6); changeset `runtime-otp`
- ~~`collapseWhitespace` use-action~~ **landed (2026-07-28)** — whitespace collapse on blur; changeset `runtime-collapse-whitespace`
- ~~`removeWhitespace` use-action~~ **landed (2026-07-28)** — strip whitespace on blur; changeset `runtime-remove-whitespace`
- ~~`expiry` use-action~~ **landed (2026-07-28)** — card expiry MM/YY formatter; changeset `runtime-expiry`
- ~~`letters` use-action~~ **landed (2026-07-28)** — letters-only input filter; changeset `runtime-letters`
- ~~`pin` use-action~~ **landed (2026-07-28)** — PIN digit filter (max 4); changeset `runtime-pin`
- ~~`ascii` use-action~~ **landed (2026-07-28)** — printable ASCII input filter; changeset `runtime-ascii`
- ~~`currency` use-action~~ **landed (2026-07-28)** — currency amount input filter; changeset `runtime-currency`
- ~~`percent` use-action~~ **landed (2026-07-28)** — percentage input filter; changeset `runtime-percent`

**Kabul edilebilir post-v1:** other transitions (e.g. crossfade send/receive), on-demand ISR, deeper soft hydrate (DOM reuse)

## Commands

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
