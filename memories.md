# memories.md

Güncelleme: 2026-07-21

## Proje

- **avedon**: TypeScript-first full-stack web framework
- Workspace: `/home/anilo/Projeler/avedon` (pnpm workspaces + Turborepo) — GitHub: `avedonjs/avedon` (public)
- Spec: `docs/superpowers/specs/2026-07-20-avedon-design.md`

## Marka / paket isimleri (2026-07-21)

- Monorepo kök: `avedon`
- Scoped paketler: `@avedon/*` (shared, compiler, runtime, server, vite-plugin, adapter-*)
- CLI: `avedon` (`packages/cli`, komutlar: `avedon dev|build|start|create`)
- Scaffold: `create-avedon-app` → `pnpm create avedon-app`
- Bileşen uzantısı: `.ave` (eski `.vex`); tipler: `*.ave.d.ts`
- Uygulama config: `avedon.config.ts`; cache: `.avedon/`
- Runtime işaretleri: `__AVEDON_DATA__`, `%avedon.head%`, `%avedon.body%`, `data-avedon-*`, HMR `avedon:update`

## Kararlar

- UI: `.ave` (Svelte benzeri)
- Routing: `defineRoutes` + `route(path, config)`
- Reaktivite: `@avedon/runtime`
- Toolchain: Vite + `@avedon/vite-plugin`

## Marka görsel

- Logo paketi: `logo/` (crop mark + monogram A; accent `#06B6D4`; explorations altında B/C taslakları)
- README: `<picture>` + `logo-horizontal-{light,dark}.png`; favicon/OG: `examples/basic-app/public/`
- Wordmark: küçük harf `avedon`

## Tercihler

- Ana branch; commit yalnızca kullanıcı isterse

## Durum

- **Rename (2026-07-21):** proje ve GitHub org `avedon` / `avedjs`; eski `vexjs` adı kod tabanında kullanılmıyor
- DoD: `pnpm build`, `pnpm test`, `pnpm test:smoke` geçti (2026-07-21 rename sonrası)
- **Denetim turu (2026-07-21):** create monorepo `file:` link + `e2e/create-smoke.mjs`; CSRF Origin/Referer dokümantasyonu; streaming TTFB unit test; `e2e/isr-smoke.mjs`; basic-app login + `requireSession`; action redirect + Set-Cookie düzeltmesi; `getSession` export
- **Streaming SSR varsayılan (2026-07-21):** `earlyShell` kaldırıldı; SSR default stream + ~40ms shell gecikmesi; post-shell redirect → `window.location` script; `bufferHtml` opt-out; `/login` bufferHtml; `e2e/stream-redirect-smoke.mjs`
- **GitHub Actions (2026-07-21):** `ci.yml`, `e2e.yml`, `release.yml`, `codeql.yml` kuruldu; Changesets (`@changesets/cli`); CI/E2E/CodeQL yeşil; Release `NPM_TOKEN` bekliyor (ENEEDAUTH beklenen); smoke orphan process tree kill düzeltmesi; branch protection önerisi CONTRIBUTING.md'de

## Komutlar

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
