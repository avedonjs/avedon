# Rendering

Each route selects how HTML is produced via the `render` field on `defineRoutes`.

| Mode | When HTML is produced | Typical use |
|------|----------------------|-------------|
| `ssr` | On each request | Dynamic, personalized, or frequently changing data |
| `ssg` | At `avedon build` | Mostly static marketing or content pages |
| `csr` | In the browser | Highly interactive shells after a minimal boot |

Default when unspecified: **`ssr`**.

## SSR

Server-side rendering runs `load` per request, then **streams** HTML that the client hydrates.

**Default:** SSR routes stream a `ReadableStream` body. The framework does not wait for the full page HTML before sending bytes unless you opt out with `bufferHtml: true`.

### Streaming (default)

1. **Shell timing:** avedon starts `load()` and waits up to ~40ms before flushing the document shell (head + opening `#app`). If `load()` is still running after the window, the shell flushes early so TTFB stays low.
2. Sync template HTML streams next; slow work can follow in later chunks.
3. `{#await}` blocks emit a placeholder, then a late injection when the promise settles.
4. `__AVEDON_DATA__` and the client entry are sent after await boundaries settle.

Use for request-dependent data, fresh pages, and slow `{#await}` regions where early bytes matter.

### `bufferHtml: true`

When set on an SSR route, avedon waits for `load()` and the full HTML body, then sends one complete document. Use when:

- **`load()` often redirects or errors** — you need real HTTP `302` / `404` / `403` without post-shell fallback
- Streaming buys little on a fast route

If only the `<head>` depends on `load`, prefer `awaitHead: true` — it keeps the body streaming.

### `awaitHead: true`

Streaming flushes the shell before `load()` settles, so a [`head` returned by `load`](./loading-data.md#page-head) would arrive after `<head>` is already on the wire. Set `awaitHead: true` on the route to wait for `load()` before flushing the shell; the body still streams and `{#await}` boundaries still work.

```ts
route('/posts/:id', { component: Post, awaitHead: true })
```

`ssg`, `csr`, and `bufferHtml` routes already await `load()`, so they need no flag. A streaming route that returns `head` without `awaitHead` throws in dev and warns in production, and its `head` is ignored — the behaviour does not silently depend on how fast `load()` happens to be.

### Redirects and errors in `load()`

| When | Behavior |
|------|----------|
| `load()` finishes **before** the shell is committed | Normal HTTP: `redirect()` → `302`; `notFound()` / `error()` → matching status |
| Shell **already sent**, then `load()` redirects | Injects `<script>window.location.href=…</script>` (cannot change status) |
| Shell **already sent**, then `notFound()` / `error()` | Error UI streams into the body; HTTP status stays 200 |

Form **actions** (POST) always use full HTTP responses for redirects and `Set-Cookie`.

## SSG

Static generation runs at build time. HTML is served as a static asset (still hydrates when needed).

### `getStaticPaths`

For parameterized SSG routes, return **full pathnames**:

```ts
{
  path: '/docs/:slug',
  component: Doc,
  render: 'ssg',
  getStaticPaths: () => ['/docs/intro', '/docs/api'],
}
```

Prefer `getStaticPaths`; `entries` is an alias. Routes with `:params` and no path list are skipped at build.

### ISR: `revalidate`

By default SSG HTML is immutable until the next `avedon build`. Set `revalidate` (seconds) for stale-while-revalidate in production (`avedon start`):

| `revalidate` | Behavior |
|--------------|----------|
| omitted | Forever static |
| `N > 0` | After N seconds, next GET returns cached HTML and regenerates in the background |
| `0` | Every request treated as stale (regen deduped per path) |

**Not in v1:** on-demand `revalidatePath` / tags, or regenerating paths that were never built. `avedon dev` does not run the disk ISR loop.

## CSR

Client-side rendering skips server HTML for the page body beyond the application shell. Guards still apply when configured. Use for app-like surfaces or auth-gated views that are not meant for public HTML snapshots.

## Hydration and client navigation

After SSR/SSG HTML reaches the browser, avedon **claim-hydrates**: it walks the existing DOM with a cursor, reuses matching nodes, and attaches listeners/effects in place. Live node identity is preserved (focus, media, embeds) on the happy path.

**Mismatch:** if the client tree does not match the SSR HTML (wrong tag, missing comment anchors, slotted components, `{@html}`, etc.), **dev throws** and **production soft-remounts** (build into a holder, `replaceChildren`, then restore form/open/scroll/focus). Empty targets and `[data-avedon-csr]` always use a normal `mount`.

**Signals win:** after a successful claim, effects apply current prop/signal values onto claimed nodes — early user edits between paint and hydrate may be overwritten.

SSR and streaming emit comment anchors (`<!--if-->`, `<!--each-->`, `<!--each-keyed-->`, `<!--key-->`, `<!--await-->`) so block markers line up with the client claim walk. Adjacent static text and `{expr}` segments are separated with empty `<!-- -->` comments so the HTML parser does not coalesce them into a single text node (which would break claim).

Client navigation moves `#app` children from the fetched document via `replaceChildren` (no `innerHTML` round-trip), then hydrates the new tree.

## Mixing modes

One `routes.ts` can mix `ssg`, `ssr`, and `csr`. Choose per route.

## Build output

`avedon build` produces client assets, server bundles, and SSG HTML. The Node adapter serves production via `avedon start` — see [Deployment](./deployment.md).
