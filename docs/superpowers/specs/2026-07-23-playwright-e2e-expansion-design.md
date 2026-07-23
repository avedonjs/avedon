# Playwright e2e expansion

Updated: 2026-07-23  
**Status:** Approved for implementation (2026-07-23)  
**Plan:** `docs/superpowers/plans/2026-07-23-playwright-e2e-expansion.md`  
**Scope:** Wire Playwright into CI; fill browser-only gaps for `examples/basic-app`; add a thin static e2e suite for `apps/www`

## Goal

Make browser e2e a first-class gate: existing Playwright specs run in CI, cover the remaining **browser-visible** basic-app behaviors that Node smoke cannot assert well, and smoke-test the public docs site artifact without duplicating Node smoke coverage.

## Non-goals

- Rewrite or delete existing Node smoke scripts (`e2e/*-smoke.mjs`)
- Multi-browser matrix (Firefox / WebKit)
- Production (`avedon build` + `server.js`) Playwright for basic-app (Node smokes already cover ISR / stream-redirect / TTFB against prod)
- Trusted Publisher, Cloudflare/Bun adapters
- Visual regression / Lighthouse in CI
- Deep docs content assertions (every slug, Shiki token checks)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Strategy | **Thin layer** — keep Node smokes; Playwright = CI + browser gaps + www static smoke |
| CI home | Extend `.github/workflows/e2e.yml` with a Playwright job (Chromium only) |
| basic-app server | Existing `playwright.config.ts` `webServer` → `avedon dev` on `examples/basic-app` |
| www server | Separate Playwright project/config: build `apps/www`, serve `build/client` statically |
| Parallelism | Keep `workers: 1` / `fullyParallel: false` while HMR mutates `Post.ave` |
| CSRF coverage | Playwright `request` (or page) POST without Origin/Referer → expect reject; happy path already covered |

## Phases

### Phase 1 — CI wiring

- Add a job (e.g. `playwright`) to `e2e.yml` that: install → build → refresh bins → `npx playwright install --with-deps chromium` → `pnpm test:e2e`.
- Job must not race Node smoke on the same runner resources if both start `5173`; prefer **separate jobs** (smoke + playwright) so each owns its own checkout/process.
- Fail the workflow if either job fails.
- Document in `CONTRIBUTING.md` that `pnpm test:e2e` is required when touching client routing / HMR / forms / www static output (already partially noted).

### Phase 2 — basic-app browser gaps

New or extended specs under `e2e/` (dev server via existing config):

| Spec | Asserts |
|------|---------|
| Login UI → admin | Fill `/login` form in the browser, submit, navigate to `/admin`, see CSR admin content (complements request-only guard tests) |
| CSRF reject | POST form action **without** Origin/Referer → non-success (4xx); with matching Origin → success (or reuse existing like action) |
| Stream post-shell redirect | Hit a stream-redirect lab path that emits shell then client redirect; browser ends on target URL (Node smoke already covers HTTP 302 fast path) |
| Home signal | Increment / live signal demo updates DOM without full reload |

Do **not** re-implement ISR revalidate timing or TTFB curl checks in Playwright.

### Phase 3 — www static smoke

- Add `apps/www` Playwright config (or a second project in root config with its own `webServer` / `baseURL` / `testMatch`).
- `webServer`: generate+build www, then serve `apps/www/build/client` (e.g. `npx serve` or `python -m http.server`) on a fixed port.
- Tests (minimal):
  - `/` shows brand “avedon” and primary CTA to docs
  - `/docs/` loads hub
  - `/docs/quick-start/` shows Quick start heading / known content
  - `/robots.txt` is plain text with `Sitemap:` (not HTML)
- Run www suite in the same Playwright CI job **after** or as a separate project in one `pnpm test:e2e` invocation so one Chromium install serves both.

## Architecture

```
e2e.yml
├── job: smoke          → pnpm test:smoke (Node; unchanged)
└── job: playwright
      ├── pnpm build
      ├── playwright install chromium
      └── pnpm test:e2e
            ├── project: basic-app  (dev @ :5173)
            │     smoke.spec.ts, hmr.spec.ts, + phase-2 specs
            └── project: www        (static build/client @ fixed port)
                  www.spec.ts
```

## File map (expected)

| Path | Role |
|------|------|
| `.github/workflows/e2e.yml` | Add Playwright job |
| `playwright.config.ts` | Multi-project: basic-app + www (or www sibling config imported) |
| `e2e/*.spec.ts` | Existing + phase-2 basic-app specs |
| `e2e/www.spec.ts` (or `e2e/www/*.spec.ts`) | Phase-3 static site smoke |
| `package.json` | Keep `test:e2e`; optional `test:e2e:www` alias if useful |
| `CONTRIBUTING.md` | Clarify Playwright vs smoke |
| `memories.md` | Mark phases done as they land |

## Success criteria

1. Push/PR runs Playwright Chromium in CI and fails on red specs.
2. Login → admin works in a real browser session (cookies + CSR).
3. CSRF missing-origin is rejected in e2e.
4. At least one post-shell streaming redirect is observed in the browser.
5. www static suite passes against a fresh `pnpm -F www build` artifact, including real `robots.txt`.
6. Node `pnpm test:smoke` remains green and unchanged in responsibility.

## Follow-ups (out of this spec)

- Firefox/WebKit matrix
- Prod-server Playwright for basic-app
- Broader www content / a11y automated checks
- Flake quarantine dashboard
