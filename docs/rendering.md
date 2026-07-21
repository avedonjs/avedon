# Rendering modes

Each route selects how HTML is produced via the `render` field on `defineRoutes`.

| Mode | When HTML is produced | Typical use |
|------|----------------------|-------------|
| `ssr` | On each request | Dynamic, personalized, or frequently changing data |
| `ssg` | At `avedon build` | Mostly static marketing or content pages |
| `csr` | In the browser | Highly interactive shells after a minimal boot |

Default when unspecified: **`ssr`**.

## SSR

Server-side rendering runs `load` (and related pipeline steps) per request, then **streams** HTML that the client hydrates.

**Default behavior:** SSR routes stream a `ReadableStream` body. The framework does **not** wait for the full page HTML before sending bytes unless you opt out with `bufferHtml: true`.

### Streaming (default)

1. **Shell timing:** AVEDON starts `load()` and waits up to ~40ms before flushing the document shell (head + opening `#app`). If `load()` completes within that window with data only, the shell is sent and the body streams as usual. If `load()` is still running after the window, the shell is flushed early so TTFB stays low while slow data loads.
2. Sync template HTML and `renderInto` / `renderToStream` output stream next; slow component work can follow in later chunks.
3. `{#await}` blocks emit a placeholder immediately, then a late injection payload when the promise settles.
4. `__AVEDON_DATA__` and the client entry are sent only after all await boundaries settle (hydrate sees a complete DOM).

Compiled SSR modules export `renderToStream` / `renderInto` (streaming) and sync `render` (back-compat; awaits stay empty in the sync path).

Node (`avedon start`) and `avedon dev` pipe the stream without buffering the full body first.

Use for:

- Data that depends on the request (params, cookies, auth)
- Pages that must be fresh on every visit
- Large pages or slow `{#await}` regions where early bytes matter

Example: `/posts/:id` in the basic app; `/stream` demonstrates a delayed `{#await}`; `/stream-ttfb/stream` vs `/stream-ttfb/buffer` compare default streaming TTFB to buffered SSR.

### `bufferHtml: true` (opt-out)

When set on an SSR route, AVEDON waits for `load()` and the full HTML body, then sends one complete document (no response stream). Use when:

- **`<head>` depends on `load`** — `<title>`, meta tags, or Open Graph fields must be correct in the first HTML snapshot for SEO or social previews.
- **`load()` often redirects or errors** — e.g. auth gates that must return real HTTP `302`/`404`/`403` without relying on post-shell fallback (see below). Example: `/login` in the basic app uses `bufferHtml: true` for predictable HTML on auth-related GETs.
- **Simplicity on fast routes** — when streaming buys little, buffering is fine.

### Redirects and errors in `load()`

| When | Behavior |
|------|----------|
| `load()` finishes **before** the shell is committed (~40ms window or fast `load`) | Normal HTTP response: `redirect()` → `302` + `Location`; `notFound()` / `error()` → matching status and HTML error page. |
| Shell **already sent**, then `load()` redirects | Cannot change status or `Location`. AVEDON injects `<script>window.location.href=…</script>` into the stream and closes the document. |
| Shell **already sent**, then `load()` throws `notFound()` / `error()` | Route `notFound` / `error` component HTML is rendered into the stream (HTTP status stays 200 — already committed). Generic message if no component is configured. |

Form **actions** (POST) are unchanged: redirects and `Set-Cookie` from actions are always full HTTP responses, not streamed page renders.

## SSG

Static generation runs at build time. The resulting HTML is served as a static asset (still hydrates on the client when needed).

Use for:

- Pages whose data is known at build time
- Fast first paint for stable content

Example: `/` home page in the basic app.

### Dynamic paths: `getStaticPaths`

For parameterized SSG routes (`/docs/:slug`), export a path list on the route config. Prefer **`getStaticPaths`**; `entries` is an alias.

```ts
{
  path: '/docs/:slug',
  component: Doc,
  render: 'ssg',
  getStaticPaths: () => ['/docs/intro', '/docs/api'],
}
```

Return **full pathnames** (not bare param values). At `avedon build`, each path runs `load` once and writes static HTML. Routes with `:params` and no `getStaticPaths` / `entries` are skipped.

### ISR: `revalidate`

By default SSG HTML is **immutable** until the next `avedon build`. Set `revalidate` (seconds) on an `ssg` route for **stale-while-revalidate** regeneration in production (`avedon start` / Node adapter):

```ts
{
  path: '/docs/:slug',
  component: Doc,
  render: 'ssg',
  revalidate: 60,
  getStaticPaths: () => ['/docs/intro', '/docs/api'],
}
```

| `revalidate` | Behavior |
|--------------|----------|
| omitted | Forever static (current default) |
| `N > 0` | After N seconds, the next GET still returns the cached HTML immediately and regenerates in the background |
| `0` | Every request is treated as stale (regen deduped per path) |

Regeneration uses the same `renderSsgPage` path as build (load + layouts + shell). On failure, the previous file is kept and the error is logged.

**Not in v1:** on-demand `revalidatePath` / tags, CDN `Cache-Control` ISR, or regenerating paths that were never built.

`avedon dev` does not run this disk ISR loop (pages are served via the normal request pipeline).

## CSR

Client-side rendering skips server HTML for the page body beyond the application shell. The client fetches data and renders in the browser. Guards still apply when configured.

Use for:

- App-like surfaces where server HTML for the view is optional
- Routes that are behind auth and not meant for public HTML snapshots

Example: `/admin` in the basic app.

## Mixing modes

Hybrid apps are intentional: one `routes.ts` can mix `ssg`, `ssr`, and `csr`. Choose per route rather than forcing a single strategy for the whole site.

## Build output

`avedon build` produces client assets, server bundles, and SSG HTML for routes marked `ssg`. The Node adapter (`@avedon/adapter-node`) serves the production app via `avedon start`.
