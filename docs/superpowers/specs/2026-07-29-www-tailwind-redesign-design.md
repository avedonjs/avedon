# www Product-stage Tailwind redesign

Updated: 2026-07-29  
**Status:** Approved  
**Scope:** `apps/www` site chrome (home, docs, playground chrome, header/layout, error/404)

## Goal

Rebuild the docs site with Tailwind v4 (PostCSS, create-app pattern) under a Product-stage visual redesign: keep dark / Syne / cyan brand, strip co-located `<style>` from `.ave` files, utility-first chrome, minimal `app.css` for prose / CodeMirror / atmosphere / Shiki.

## Non-goals

- Changing playground iframe Tailwind (`@tailwindcss/browser` + presets)
- Changing `create-avedon-app` scaffold
- Framework package APIs
- `@tailwindcss/vite` (CLI cannot merge Vite plugins yet)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Direction | C + 1 — brand-preserving Product stage redesign |
| Toolchain | Tailwind v4 + `@tailwindcss/postcss` + `postcss` |
| Theme | create-app `@theme` tokens (`bg`, `fg`, `muted`, `accent` `#06B6D4`, …) |
| Docs prose | Hand-tuned `.prose` in `app.css` (no typography plugin) |
| `.ave` CSS | Remove; specials only in `app.css` |
| Home first viewport | Brand, headline, support, CTAs, Counter specimen; install + traits below fold |

## Architecture

- `src/app.css` ← `@import "tailwindcss"` + `@theme` + specials
- `src/client.ts` imports `./app.css` before `virtual:avedon-client-entry`
- Vite extracts CSS → `/assets/client-*.css` linked via existing `clientCss` shell support
- Templates use Tailwind utility classes

## Success criteria

- No co-located layout CSS in www `.ave` files
- Site reads as redesigned but unmistakably avedon
- Docs readable; playground editor usable; home specimen Shiki-highlighted
- `pnpm -F www build` and www Playwright green
