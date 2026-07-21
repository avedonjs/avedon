# memories.md

Güncelleme: 2026-07-21

## Proje

- **vexjs**: TypeScript-first full-stack web framework
- Workspace: `/root/vexjs` (pnpm workspaces + Turborepo)
- Spec (uygulanan): kullanıcı uçtan-uca yapım promptu + `docs/superpowers/specs/2026-07-20-vexjs-design.md`

## Kararlar

- UI: `.vex` (Svelte benzeri; `<template>` + scoped `<style>` + client/server script)
- Routing: `defineRoutes` + additive `route(path, config)` (typed params); plain `{ path }` objects still supported (weaker guard inference)
- Server: `load` + `actions` + `api_*` aynı `.vex` içinde (`<script server>`)
- API: route-relative `.json` / `Accept: application/json` → `api_GET` vb.; absolute `api` map de desteklenir
- Actions: `?_action=name` (ve `?/name` uyumluluğu)
- Guard: `guard` (alias: `canActivate`)
- Middleware: `hooks.middleware` + `sequence`; built-ins `cors` / `logger` / `rateLimit` (guards’tan ayrı)
- Reaktivite: `signal` / `computed` / `effect` (`@vexjs/runtime`)
- Toolchain: Vite + `@vexjs/vite-plugin`; paket build: `tsup`
- Render: hibrit `ssr` | `ssg` | `csr` (varsayılan `ssr`); SSR out-of-order stream; SSG + isteğe bağlı ISR (`revalidate`)
- Adapter: Node gerçek; Bun/Cloudflare arayüz stub
- Örnek: `examples/basic-app` (paket adı `example`)

## Tercihler

- Ana branch üzerinde çalış; gereksiz branch açma
- Commit yalnızca kullanıcı isterse
- Plan dosyasını kullanıcı istemeden düzenleme
- Spesifikasyon promptlarında ara onay isteme

## Durum

- pnpm + turbo monorepo; `@vexjs/shared` eklendi; CLI `packages/cli` (`vex`)
- DoD: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm test:smoke`, `pnpm test:e2e` geçti
- `pnpm -F example build:app` → `build/client/index.html` (SSG `/`)
- Server script client bundle’a sızmıyor (compiler leak testi + build kontrolü)
- GitHub community standards (2026-07-21): MIT LICENSE, CoC, CONTRIBUTING, SECURITY, SUPPORT, issue/PR templates
- Operatör adımı: GitHub’da private vulnerability reporting (ve isteğe bağlı Discussions) UI’dan açılmalı
- README profesyonel yeniden yazıldı; `docs/` index + guide/vex-components/routing/middleware/rendering/packages
- **Middleware** (2026-07-21): `hooks.middleware` + `sequence`; built-in `cors` / `logger` / `rateLimit`; guard’lardan ayrı
- **Streaming SSR OOO** (2026-07-21): `renderToStream` / `renderInto`; `{#await}` placeholder + late inject; shell prefix/suffix; Node/Vite pipe (`@vexjs/server/node`); örnek `/stream`

## Bu tur (session design)

- Cookie + sealed session helpers tasarlandı (login/OAuth yok)
- Spec: `docs/superpowers/specs/2026-07-21-session-design.md`
- `@vexjs/server`: `event.cookies`, opsiyonel `event.session`, Web Crypto AES-GCM, `requireSession`
- Güncelleme: 2026-07-21

## Spec boşlukları (doğrulama 2026-07-21)

- ~~Tip güvenliği~~ **kapatıldı**: `route()` + `LoadEvent<'/path'>` + `ExtractParams`; `.vex.d.ts` → `Props.data` somut tip
- ~~HMR~~ **kapatıldı**: server-only → full-reload; client/template/style → `vex:update` + signal state transfer; prod’da HMR yok
- **Client nav**: e2e `__navMarker` ile doğrulandı
- **Adapter**: Node somut; Bun + Cloudflare stub
- ~~create-vex-app / `vex create`~~ **kapatıldı**: `packages/create-vex-app` + paylaşılan şablon; `pnpm create vex-app`
- ~~Error / notFound sayfaları~~ **kapatıldı**: `notFound()`/`error()` throw → matched route + 404→`notFound` component
- ~~CSRF~~ **kapatıldı**: form `actions` için Origin/Referer (varsayılan açık; `csrf: false` / `trustedOrigins`)
- ~~getStaticPaths~~ **kapatıldı**: build + docs + örnek `/docs/:slug`; SSG layout zinciri `matchRoute` chain
- ~~Cache/revalidate (ISR)~~ **kapatıldı**: route `revalidate` + SWR disk regen (`tryServeSsgIsr`); on-demand yok
- **Session/cookies**: **kapatıldı** — `event.cookies`, sealed session, `requireSession`; docs/session.md

## Bu tur (ISR)

- `renderSsgPage` / `buildSsgPages` → `@vexjs/server`; CLI re-export
- `revalidate?: number` on `RouteConfig`; Node adapter SWR + path lock + atomic write
- Örnek `/docs/:slug` `revalidate: 60`
- Güncelleme: 2026-07-21

## Bu tur (session design)

- Cookie + sealed session helpers tasarlandı (login/OAuth yok)
- Spec: `docs/superpowers/specs/2026-07-21-session-design.md`
- `@vexjs/server`: `event.cookies`, opsiyonel `event.session`, Web Crypto AES-GCM, `requireSession`
- Client guard: `requireSession` allow (httpOnly); enforcement server’da
- Güncelleme: 2026-07-21

## Komutlar

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
