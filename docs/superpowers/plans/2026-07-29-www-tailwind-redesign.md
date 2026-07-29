# www Product-stage Tailwind redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `apps/www` with Tailwind v4 PostCSS under Product-stage redesign.

**Architecture:** `app.css` + PostCSS → Vite `clientCss`; `.ave` templates utility-only; specials (prose, CM, stage, shiki) in `app.css`.

**Tech Stack:** Tailwind 4.1.x, `@tailwindcss/postcss`, PostCSS 8, existing avedon SSG.

See approved design: `docs/superpowers/specs/2026-07-29-www-tailwind-redesign-design.md`.

## Tasks

1. Wire PostCSS + `app.css` + `client.ts` import; add deps to `apps/www/package.json`
2. Rebuild Layout + SiteHeader utilities
3. Rebuild Home (hero budget + secondary install + specimen)
4. Docs chrome + prose in `app.css`
5. Playground chrome + CM overrides in `app.css`
6. error / not-found; strip leftover styles; verify e2e
