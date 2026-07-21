# memories.md

Güncelleme: 2026-07-21

## Proje

- **vexjs**: TypeScript-first full-stack web framework
- Workspace: `/root/vexjs` (pnpm workspaces + Turborepo)
- Spec (uygulanan): kullanıcı uçtan-uca yapım promptu + `docs/superpowers/specs/2026-07-20-vexjs-design.md`

## Kararlar

- UI: `.vex` (Svelte benzeri; `<template>` + scoped `<style>` + client/server script)
- Routing: `defineRoutes` / açık `routes.ts` (dosya tabanlı değil)
- Server: `load` + `actions` + `api_*` aynı `.vex` içinde (`<script server>`)
- API: route-relative `.json` / `Accept: application/json` → `api_GET` vb.; absolute `api` map de desteklenir
- Actions: `?_action=name` (ve `?/name` uyumluluğu)
- Guard: `guard` (alias: `canActivate`)
- Reaktivite: `signal` / `computed` / `effect` (`@vexjs/runtime`)
- Toolchain: Vite + `@vexjs/vite-plugin`; paket build: `tsup`
- Render: hibrit `ssr` | `ssg` | `csr` (varsayılan `ssr`)
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
- README profesyonel yeniden yazıldı; `docs/` index + guide/vex-components/routing/rendering/packages (diğer framework karşılaştırması yok)

## Komutlar

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
