# Per-page `<head>` (title / description) design

Updated: 2026-07-26
**Status:** Approved for implementation (2026-07-26)
**Plan:** `docs/superpowers/plans/2026-07-26-page-head.md`

## Goal

Let each route control `<title>` and `<meta name="description">` (plus optional raw head HTML) from `load`, so apps built with avedon — and the avedon docs site itself — stop shipping one identical `<title>` for every page.

Today `renderShellPrefix` accepts a `head` string but the pipeline never passes one, so `%avedon.head%` is always empty. Every page of `https://avedon.pages.dev` currently renders `<title>avedon</title>`.

## Non-goals (v1)

- Open Graph / Twitter helper fields (`ogTitle`, `ogImage`, …) — use raw `head.html`
- `<svelte:head>`-style markup blocks
- Canonical URL / sitemap / robots automation
- Per-layout head merging (only the leaf route's `load` contributes)
- Changing streaming SSR defaults for routes that do not opt in

## Locked decisions

| Topic | Choice |
|-------|--------|
| Source | `load` return value, under a dedicated `head` key |
| Fields | `title?`, `description?`, `html?` (raw, trusted) |
| Escaping | `title` and `description` are HTML-escaped; `html` is trusted (same contract as `{@html}`) |
| Streaming SSR | **Opt-in** per route via `awaitHead: true` — shell flush waits for `load` |
| SSG / CSR / `bufferHtml` | Head works automatically (these paths already await `load`) |
| Missing opt-in | `load` returns `head` on a streaming route without `awaitHead` ⇒ dev: throw; prod: `console.warn` and ignore |
| Fallback | No `head.title` ⇒ the `<title>` already in `app.html` stays |

### Why opt-in

Whether a route has a head is only known **after** `load` resolves. Always waiting would delay the shell for every route: `e2e/ttfb-smoke.mjs` asserts streaming TTFB stays under 0.5s on a route whose `load` takes 800ms, and always-waiting would push that to ~800ms, removing the main benefit of streaming SSR. Opt-in keeps fast routes fast; the dev-time throw prevents a silently missing title.

## API

```ts
export async function load({ params }: LoadEvent<'/posts/:id'>) {
  const post = await getPost(params.id)
  return {
    data: { post },
    head: {
      title: `${post.title} — avedon`,
      description: post.excerpt,
      html: '<meta property="og:type" content="article" />', // optional, trusted
    },
  }
}
```

```ts
route('/posts/:id', { component: Post, awaitHead: true })
```

`awaitHead` is unnecessary for `render: 'ssg'`, `render: 'csr'`, or `bufferHtml: true`.

### Types

```ts
export interface HeadMeta {
  title?: string
  description?: string
  /** Raw, trusted HTML appended to <head> — see docs/security.md */
  html?: string
}
```

- `RouteConfig.awaitHead?: boolean`
- `HandlerOptions.dev?: boolean` (set by the Vite dev middleware) — drives throw vs warn
- `head` stays inside the load result / page props so the client can update `document.title` on navigation

## Rendering rules

`renderShellPrefix(appHtml, { head, css })` where `head?: HeadMeta`:

1. **title** — if `head.title` is set: replace an existing `<title>…</title>` in `app.html`; if none exists, append `<title>` into the head block. Escaped.
2. **description** — if `head.description` is set: replace an existing `<meta name="description" …>`; otherwise append one. Escaped.
3. **html** — appended verbatim to the head block.
4. No `head` ⇒ current behaviour, unchanged.

The existing `head?: string` parameter is replaced by `head?: HeadMeta` (internal API; the pipeline is its only caller).

## Pipeline behaviour

| Path | Head handling |
|------|----------------|
| SSG (`renderSsgPage`) | `load` already awaited ⇒ inject |
| CSR | `load` already awaited ⇒ inject into shell |
| SSR + `bufferHtml` | `load` already awaited ⇒ inject |
| SSR streaming + `awaitHead: true` | `await loadPromise` before the shell prefix, then inject; body still streams and `{#await}` boundaries still work |
| SSR streaming without `awaitHead` | Shell flushes on the existing ~40ms race; if `load` later returns `head`, dev throws / prod warns |

Post-shell redirect and error fallbacks are unchanged for non-opt-in routes. For `awaitHead` routes the load outcome is known before the shell, so `redirect()` / `notFound()` naturally produce real HTTP status codes.

## Client navigation

After a client-side route mount, if the page data contains `head.title`, set `document.title`. Description/raw html are not synced client-side in v1 (crawlers read the SSR HTML).

## Testing

- `ssr.test.ts` (new or existing suite): title replace vs append; description replace vs append; escaping of `<`/`&` in title and description; `html` passthrough; no-head no-change.
- `pipeline.test.ts`: CSR + `bufferHtml` inject head; streaming route with `awaitHead` injects head; streaming route without `awaitHead` returning head throws when `dev: true` and warns when not.
- `ssg.test.ts`: SSG page HTML contains the load-provided title.
- e2e: a basic-app route with `awaitHead` shows the right `<title>` in the SSR response.
- Regression: `e2e/ttfb-smoke.mjs` thresholds must still pass unchanged (no route in that lab opts in).

## Docs

- `docs/loading-data.md`: document the `head` key on the load result.
- `docs/rendering.md`: replace the "`<head>` depends on `load` ⇒ use `bufferHtml`" advice with `awaitHead`.
- `docs/routing.md`: add `awaitHead` to the route field list.

## Rollout for `apps/www`

Docs pages are SSG, so they gain per-page titles with no flag: pass `head: { title, description }` from the docs `load` (page title + blurb). This is the concrete SEO fix for `avedon.pages.dev`.

## Acceptance

- `pnpm build && pnpm test && pnpm typecheck && pnpm test:smoke` green; Playwright green.
- `apps/www` generated HTML has a distinct `<title>` per docs page.
- A streaming SSR route that returns `head` without `awaitHead` fails loudly in dev.
