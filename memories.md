# memories.md

Güncelleme: 2026-07-21

## Proje

- **avedon** (eski ad: vexjs): TypeScript-first full-stack web framework
- Workspace: `/home/anilo/Projeler/vexjs` (pnpm workspaces + Turborepo) — GitHub: `avedonjs/avedon`
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

## Tercihler

- Ana branch; commit yalnızca kullanıcı isterse

## Durum

- **Rename + GitHub (2026-07-21):** kaynak `avedonjs/avedon` (private); eski `hocestnonsatis/vexjs` silindi
- DoD: `pnpm build`, `pnpm test`, `pnpm test:smoke` geçti (2026-07-21 rename sonrası)

## Komutlar

```bash
pnpm install && pnpm build && pnpm test && pnpm test:smoke
pnpm -F example dev
pnpm -F example build:app && pnpm -F example start
pnpm test:e2e
```
