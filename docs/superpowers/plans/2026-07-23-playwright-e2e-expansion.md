# Playwright e2e expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Playwright into CI, add browser-only basic-app coverage (login UI, CSRF, stream client redirect, home signal), and add a thin static smoke suite for `apps/www`.

**Architecture:** Keep Node `e2e/*-smoke.mjs` unchanged. Root `playwright.config.ts` continues to drive `examples/basic-app` via `avedon dev`. A second config `playwright.www.config.ts` builds `apps/www` and serves `build/client` statically. `pnpm test:e2e` runs both configs sequentially. CI adds a separate Playwright job alongside the existing Smoke job.

**Tech Stack:** Playwright 1.51+, Chromium, GitHub Actions, pnpm, Python `http.server` (stdlib; no new dep for static serve)

**Spec:** `docs/superpowers/specs/2026-07-23-playwright-e2e-expansion-design.md`

## Global Constraints

- Stay on `main`; do not create feature branches
- Commit only when the maintainer explicitly asks (include `git add`/`commit` steps below but skip them until asked)
- TypeScript 5.x only (no TS 6 bump)
- English-only docs and commit messages
- Do not rewrite or delete Node smoke scripts
- Chromium only (no Firefox/WebKit)
- Do not re-implement ISR / TTFB / create-pack smoke in Playwright
- Keep HMR specs serial (`workers: 1`, `fullyParallel: false`) on the basic-app config
- Nested `<main>` on www Home already fixed to `div.stage`; do not reintroduce it

---

## File map

| Path | Responsibility |
|------|----------------|
| `.github/workflows/e2e.yml` | Add `playwright` job (smoke job unchanged) |
| `playwright.config.ts` | basic-app only; `testIgnore` www specs |
| `playwright.www.config.ts` | www static project + webServer build/serve |
| `e2e/browser-gaps.spec.ts` | Login UI, CSRF, stream slow redirect, home signal |
| `e2e/www.spec.ts` | www static smoke (brand, docs hub, quick-start, robots.txt) |
| `package.json` | `test:e2e` runs both Playwright configs |
| `CONTRIBUTING.md` | Document smoke vs Playwright; list Playwright CI check |
| `memories.md` | Mark phases done |

---

### Task 1: CI wiring + dual Playwright entry

**Files:**
- Modify: `.github/workflows/e2e.yml`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Create: `playwright.www.config.ts` (minimal stub that runs zero tests until Task 3 — or skip create until Task 3 and only change `test:e2e` in Task 3; **this task** only CI + ignore pattern)
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: existing `pnpm test:e2e` → `playwright test`; existing `e2e/smoke.spec.ts`, `e2e/hmr.spec.ts`
- Produces: CI job name `Playwright tests`; `playwright.config.ts` ignores `www.spec.ts`; CONTRIBUTING lists the new required check name

- [ ] **Step 1: Ignore www specs in the basic-app Playwright config**

In `playwright.config.ts`, add `testIgnore` so a future `www.spec.ts` is not picked up by the basic-app server:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testIgnore: ['**/www.spec.ts'],
  timeout: 60_000,
  // HMR specs mutate Post.ave on disk — must not run parallel with other app tests.
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: 'node ../../packages/cli/dist/cli.js dev',
    cwd: 'examples/basic-app',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },
})
```

- [ ] **Step 2: Add Playwright job to `e2e.yml`**

Append a sibling job (do not merge into `smoke`). Mirror install/build/refresh pattern from `smoke`, then install Chromium and run e2e:

```yaml
  playwright:
    name: Playwright tests
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Restore Turborepo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ hashFiles('pnpm-lock.yaml', 'turbo.json') }}
          restore-keys: |
            ${{ runner.os }}-turbo-

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Refresh workspace binaries after build
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Chromium
        run: pnpm exec playwright install --with-deps chromium

      - name: Playwright tests
        run: pnpm test:e2e
```

Keep the existing `smoke` job unchanged.

- [ ] **Step 3: Update CONTRIBUTING**

In `CONTRIBUTING.md` “Verify changes”, clarify:

```markdown
## Verify changes

```bash
pnpm test
pnpm test:smoke
```

`pnpm test:smoke` is Node fetch/curl coverage (ISR, streaming, create, path traversal).

If you touch client routing, HMR, forms/session UI, or `apps/www` static output, also run:

```bash
pnpm test:e2e
```

`pnpm test:e2e` is Playwright (Chromium): `examples/basic-app` + `apps/www` static smoke.
```

In the CI status checks table, add:

```markdown
| Playwright tests | E2E / Smoke |
```

- [ ] **Step 4: Require the check on `main` (maintainer)**

```bash
gh api repos/avedonjs/avedon/branches/main/protection --jq '.required_status_checks.contexts // .required_status_checks.checks'
```

If branch protection uses check names, add `Playwright tests` alongside existing Smoke/CI checks (use the same `gh api` PATCH pattern already documented for this repo; do not disable other required checks).

- [ ] **Step 5: Verify locally that existing Playwright still passes**

```bash
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: existing `smoke.spec.ts` + `hmr.spec.ts` pass. (Until Task 3, `test:e2e` is still only `playwright test`.)

- [ ] **Step 6: Commit (when maintainer asks)**

```bash
git add .github/workflows/e2e.yml playwright.config.ts CONTRIBUTING.md memories.md
git commit -m "$(cat <<'EOF'
ci: run Playwright Chromium on E2E workflow.

EOF
)"
```

---

### Task 2: basic-app browser gaps

**Files:**
- Create: `e2e/browser-gaps.spec.ts`
- Test: run via `pnpm test:e2e` (basic-app config)

**Interfaces:**
- Consumes: basic-app routes `/login`, `/admin`, `/posts/1?_action=like`, `/stream-redirect/slow`, `/`; CSRF via `assertCsrf` → HTTP 403; login action sets session + redirects to `/admin`
- Produces: four Playwright tests covering success criteria 2–4 + home signal

- [ ] **Step 1: Write failing/new specs**

Create `e2e/browser-gaps.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('login form establishes session and opens admin CSR', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/?$/)
  await expect(page.getByRole('heading', { name: 'Admin (CSR)' })).toBeVisible()
  await expect(page.locator('[data-avedon-csr]')).toBeVisible()
})

test('form action without Origin/Referer is rejected (CSRF)', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    // Intentionally omit origin / referer
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {},
  })
  expect(res.status()).toBe(403)
})

test('form action with matching Origin succeeds', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    headers: { origin: 'http://localhost:5173' },
    form: {},
  })
  expect(res.status()).toBeLessThan(400)
  const html = await res.text()
  expect(html).toContain('Hello avedon')
})

test('slow stream redirect completes via client navigation', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/stream-redirect/slow', { waitUntil: 'commit' })
  await page.waitForURL(/stream-redirect=ok/, { timeout: 20_000 })
  await expect(page.locator('.brand, [data-starter-stage] .brand')).toContainText('avedon')
})

test('home signal increment updates without full reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __sigMarker: number }).__sigMarker = 1
  })
  const count = page.locator('.demo-count')
  await expect(count).toHaveText('0')
  await page.getByRole('button', { name: 'Increment' }).click()
  await expect(count).toHaveText('1')
  const marker = await page.evaluate(
    () => (window as unknown as { __sigMarker?: number }).__sigMarker,
  )
  expect(marker).toBe(1)
})
```

- [ ] **Step 2: Run the new file**

```bash
pnpm exec playwright test e2e/browser-gaps.spec.ts
```

Expected: all five tests PASS. If CSRF “without Origin” unexpectedly passes because Playwright injects headers, switch the failing case to `origin: 'https://evil.example'` (still asserts 403) and keep the comment that missing-origin is covered by unit tests in `pipeline.test.ts` — prefer missing-origin first; only fall back if the runner cannot omit Origin.

- [ ] **Step 3: Re-run full basic-app e2e**

```bash
pnpm exec playwright test
```

Expected: smoke + hmr + browser-gaps all green.

- [ ] **Step 4: Commit (when maintainer asks)**

```bash
git add e2e/browser-gaps.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover login UI, CSRF, stream redirect, and home signal.

EOF
)"
```

---

### Task 3: www static Playwright suite

**Files:**
- Create: `playwright.www.config.ts`
- Create: `e2e/www.spec.ts`
- Modify: `package.json` (`test:e2e` script)
- Modify: `memories.md`

**Interfaces:**
- Consumes: `pnpm -F www build` → `apps/www/build/client/**`; static server on `127.0.0.1:8791`
- Produces: www smoke tests; `pnpm test:e2e` = basic-app then www

- [ ] **Step 1: Add www Playwright config**

Create `playwright.www.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.join(root, 'apps/www/build/client')
const port = 8791
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/www.spec.ts',
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  webServer: {
    command: `pnpm -F www build && python3 -m http.server ${port} --directory "${clientDir}"`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
  },
})
```

- [ ] **Step 2: Write www specs**

Create `e2e/www.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('landing shows brand and docs CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toHaveText('avedon')
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute(
    'href',
    '/docs/quick-start/',
  )
})

test('docs hub loads', async ({ page }) => {
  await page.goto('/docs/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
})

test('quick start doc renders', async ({ page }) => {
  await page.goto('/docs/quick-start/')
  await expect(page.getByRole('heading', { name: 'Quick start' })).toBeVisible()
})

test('robots.txt is plain text with sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.ok()).toBeTruthy()
  expect(res.headers()['content-type'] || '').toMatch(/text\/plain/)
  const body = await res.text()
  expect(body).toContain('User-agent:')
  expect(body).toContain('Sitemap:')
  expect(body).not.toMatch(/<!doctype html>/i)
})
```

- [ ] **Step 3: Point `test:e2e` at both configs**

In root `package.json`:

```json
"test:e2e": "playwright test && playwright test -c playwright.www.config.ts"
```

- [ ] **Step 4: Run www suite alone, then full e2e**

```bash
pnpm exec playwright test -c playwright.www.config.ts
pnpm test:e2e
```

Expected: www four tests PASS; full e2e (basic-app + www) PASS.

- [ ] **Step 5: Update memories**

In `memories.md` Next steps, mark:

```markdown
8. **Playwright e2e expansion** — done (2026-07-23): CI job `Playwright tests`; `e2e/browser-gaps.spec.ts`; `e2e/www.spec.ts` + `playwright.www.config.ts`; spec `docs/superpowers/specs/2026-07-23-playwright-e2e-expansion-design.md`
9. Later: Cloudflare/Bun adapters · Trusted Publisher OIDC
10. Housekeeping: optional custom domain for www
```

- [ ] **Step 6: Commit (when maintainer asks)**

```bash
git add playwright.www.config.ts e2e/www.spec.ts package.json memories.md docs/superpowers/specs/2026-07-23-playwright-e2e-expansion-design.md docs/superpowers/plans/2026-07-23-playwright-e2e-expansion.md
git commit -m "$(cat <<'EOF'
test(e2e): add www static Playwright smoke and dual test:e2e entry.

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Phase 1 CI Playwright job | Task 1 |
| Chromium only / separate from smoke job | Task 1 |
| CONTRIBUTING smoke vs e2e | Task 1 |
| Login UI → admin | Task 2 |
| CSRF reject | Task 2 |
| Stream post-shell client redirect | Task 2 (`/stream-redirect/slow`) |
| Home signal | Task 2 |
| www static config + build/client serve | Task 3 |
| www brand / docs / quick-start / robots.txt | Task 3 |
| Success: Node smoke unchanged | All tasks (no smoke edits) |

No placeholders. Dual-config approach avoids starting www build on every basic-app-only run while still satisfying one `pnpm test:e2e` invocation in CI.
