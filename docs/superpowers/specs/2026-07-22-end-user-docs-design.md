# End-user docs IA rewrite

Updated: 2026-07-22  
**Status:** Approved for implementation  
**Plan:** End-user docs IA rewrite (Cursor plan)

## Goal

Make the public docs site ([https://avedon.pages.dev](https://avedon.pages.dev) / `apps/www`) the canonical place for **application developers** who create apps with `pnpm create avedon-app` — not monorepo contributors who clone and build this repository.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Audience | App developers |
| Approach | Manifest-driven rewrite; new IA; flat slugs |
| Scope | Full product docs (getting started, tutorial, concepts, guides including session/middleware/security/cli/config/Node deploy) |
| Structure | `docs/{slug}.md` + `docs/manifest.json` for sidebar groups |
| Language | English |
| Contributor/monorepo content | `CONTRIBUTING.md` + `docs/superpowers/**` only (not on the public site) |

## Information architecture

| Group | Slugs |
|-------|-------|
| Getting started | `introduction`, `quick-start`, `project-structure`, `cli` |
| Tutorial | `tutorial` |
| Concepts | `components`, `routing`, `loading-data`, `rendering`, `reactivity` |
| Guides | `middleware`, `session`, `security`, `configuration`, `deployment` |

- Landing CTA → `/docs/quick-start`
- Site excludes: `packages`, `publishing`, `superpowers/**`, contributor verify/build workflows as primary paths

### Redirects (`apps/www/public/_redirects`)

```
/docs/guide /docs/quick-start 301
/docs/avedon-components /docs/components 301
/docs/packages /docs/introduction 301
```

## Pipeline

1. `docs/manifest.json` — `{ groups: [{ id, title, slugs[] }] }`
2. `apps/www/scripts/generate-docs.mjs` reads the manifest; emits `{ groups, docs }` into `.generated/docs.json`; fails if any listed `docs/{slug}.md` is missing
3. `Doc.ave` / `DocsIndex.ave` — grouped sidebar and hub; prev/next from flat manifest order
4. Relative `*.md` links rewritten to `/docs/{slug}` when the target is in the manifest

## Content rules

- Second person (“your app”); never lead with “clone this monorepo”
- Snippets assume published npm packages (`avedon`, `@avedon/*`) and the create-app scaffold
- `examples/basic-app` is an optional deep-dive, not the required path
- Page shape: short intro → minimal working example → options/pitfalls → See also
- Tutorial is step-by-step; Concepts/Guides hold reference tables

## Non-goals

- Full search, versioned docs, i18n
- MDX / interactive playgrounds
- Cloudflare Workers or Bun deploy guides (mention “not yet” only)
- Publishing `docs/superpowers/**` or `docs/publishing.md` on the site

## Success criteria

1. Every manifest slug has a page after `pnpm -F www build`
2. Getting started starts with `create avedon-app`, not monorepo build
3. Sidebar shows the four groups; old URLs redirect
4. Root README and `docs/README.md` match the new IA
