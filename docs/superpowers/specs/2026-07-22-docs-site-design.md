# Public docs site (avedon dogfood)

Updated: 2026-07-22  
**Status:** Implemented (2026-07-22)  
**Plan:** `docs/superpowers/plans/2026-07-22-docs-site.md`  
**Scope:** `apps/www` — marketing landing + documentation, built with avedon, deployed to Cloudflare Pages

## Goal

Ship a public **avedon-powered** site that is both the product landing page and the canonical place to read framework docs, using repo `docs/*.md` as the single content source (build-time markdown → HTML) and static SSG output suitable for Cloudflare Pages.

## Non-goals (v1)

- Full search, versioned docs (`/v0.1/…`), i18n
- Publishing `docs/superpowers/**` or `docs/publishing.md` on the site
- Cloudflare Workers / `@avedon/adapter-cloudflare` SSR
- MDX, interactive playgrounds, or live code runners
- Playwright e2e dedicated to `apps/www` (follow-up)
- Light theme / theme toggle
- Feature-grid marketing, pricing, testimonials

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Framework | avedon (dogfood) — not a third-party docs generator |
| Scope | Landing + real in-site docs |
| Content source | Build-time markdown from repo `docs/*.md` |
| App location | `apps/www` (not under `examples/`) |
| Architecture | SSG `Home.ave` + SSG `/docs/:slug` (`Doc.ave` + `getStaticPaths`) |
| Deploy | Cloudflare Pages — static artifact `apps/www/build/client` (no Node process) |
| Visual | Same dark-stage system as starter home / `logo/` |

## Architecture

```
docs/*.md  ──►  generate script  ──►  apps/www/.generated/docs.json
                                              │
apps/www (.ave + routes)  ── avedon build (SSG) ──►  build/client/**/index.html
                                              │
                                    Cloudflare Pages (output dir = build/client)
```

### Packages / workspace

- Extend `pnpm-workspace.yaml` with `apps/*`.
- `apps/www` is a private workspace app with `"name": "www"`, depending on `avedon` and `@avedon/*` via `workspace:*` (same pattern as `examples/basic-app`).
- Scripts: `dev`, `build` (`avedon build`), optional `pages:deploy` wrapping Wrangler; `predev` / `prebuild` run the markdown generate step.

### Content pipeline

1. **Input:** Markdown files directly under `docs/` (not recursive into `superpowers/`).
2. **v1 include list (slugs = basename without `.md`):**  
   `guide`, `avedon-components`, `routing`, `rendering`, `middleware`, `session`, `security`, `packages`
3. **v1 exclude:** `docs/README.md`, `docs/publishing.md`, anything under `docs/superpowers/`.
4. **Tooling:** lightweight markdown→HTML (e.g. `marked`). Syntax highlighting optional in v1 (can ship without).
5. **Output:** `apps/www/.generated/docs.json` — array/map of `{ slug, title, html, headings[] }` — **gitignored**.
6. **Title:** first `#` heading in the file, else humanized slug.
7. **Headings:** collect `h2`/`h3` for optional right-rail TOC.
8. **Internal links:** rewrite relative `*.md` / `./foo.md` hrefs to `/docs/{slug}` during generate.
9. **`Doc.ave` `load`:** reads `.generated/docs.json` by `params.slug`; unknown slug → `notFound()`.
10. **`getStaticPaths`:** `/docs/{slug}` for each included slug; `/docs` is a separate static route (not a `:slug`).

### Routes

| Path | Component | Render | Notes |
|------|-----------|--------|-------|
| `/` | `Home.ave` | `ssg` | Brand-first landing |
| `/docs` | `DocsIndex.ave` | `ssg` | Hub: list all v1 docs (title + one-line blurb from first paragraph) |
| `/docs/:slug` | `Doc.ave` | `ssg` | Markdown body + sidebar |

Layout: shared chrome (wordmark, Docs, GitHub). Docs routes add left sidebar (slug list); landing has no sidebar. Mobile: sidebar collapses (drawer or similar).

### Deploy (Cloudflare Pages)

- Build command (monorepo-aware): install + build workspace packages as needed, then `pnpm -F www build` (exact CI command fixed in implementation plan).
- **Output directory:** `apps/www/build/client`.
- All v1 routes are SSG → static `index.html` trees; no Node server on Pages.
- Unknown paths: default CF 404 for v1 (optional later: generated `404.html` from avedon `not-found`).

## Visual system

Aligned with [starter home](./2026-07-21-starter-home-design.md) and `logo/README.md`:

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#09090B` | Page / stage |
| `--fg` | `#FAFAFA` | Primary text / wordmark |
| `--muted` | `#A1A1AA` | Supporting text |
| `--accent` | `#06B6D4` | CTA, links, focus |
| `--accent-deep` | `#0891B2` | Hover |
| `--line` | `rgba(250,250,250,0.12)` | Nav / sidebar rules |

- **Font:** Syne (display + body), loaded in `app.html`.
- **Landing first viewport:** brand `avedon`, one headline, one supporting sentence, CTA group (Get started → `/docs/guide`, GitHub), atmospheric wash/grid — no feature grids, stat strips, or card heroes.
- **Docs prose:** readable max-width; dark code panels; sticky sidebar; optional TOC from `headings`.
- **Assets:** copy favicon / OG / horizontal logo from `logo/` into `apps/www/public/`.

## Error handling

- Missing slug in generate output or bad `params.slug` → `notFound()` (SSG should not emit that path).
- Generate failure (missing `docs/` file in include list) → fail `prebuild` loudly.
- Broken in-repo MD links rewritten only when target slug is in the include set; otherwise leave href and rely on review.

## Testing (v1)

- Unit/smoke: generate script produces expected slugs + HTML contains a known guide heading.
- Manual or thin smoke: `avedon build` writes `build/client/index.html` and `build/client/docs/guide/index.html`.
- No dedicated Playwright suite required for v1 merge.

## Success criteria

1. `pnpm -F www build` produces a Cloudflare Pages–deployable `build/client` tree.
2. `/` passes brand-first landing rules; `/docs/guide` shows real content from `docs/guide.md`.
3. Sidebar lists all v1 slugs and client/static navigation works between them.
4. Editing `docs/guide.md` and rebuilding updates the site — no hand-copied duplicate bodies in `.ave` files.

## Follow-ups (out of this spec)

- Trusted Publisher / adapter work remains separate roadmap items.
- Search, versioning, CF adapter SSR, www e2e, syntax highlighting polish.
