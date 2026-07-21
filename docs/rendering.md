# Rendering modes

Each route selects how HTML is produced via the `render` field on `defineRoutes`.

| Mode | When HTML is produced | Typical use |
|------|----------------------|-------------|
| `ssr` | On each request | Dynamic, personalized, or frequently changing data |
| `ssg` | At `vex build` | Mostly static marketing or content pages |
| `csr` | In the browser | Highly interactive shells after a minimal boot |

Default when unspecified: **`ssr`**.

## SSR

Server-side rendering runs `load` (and related pipeline steps) per request, then **streams** HTML that the client hydrates.

### Streaming (out-of-order)

SSR responses use a `ReadableStream` body:

1. Document shell (head + opening `#app`) flushes as soon as `load` finishes — improves TTFB on large pages
2. Sync template HTML streams next
3. `{#await}` blocks emit a placeholder immediately, then a late injection payload when the promise settles
4. `__VEX_DATA__` and the client entry are sent only after all await boundaries settle (hydrate sees a complete DOM)

Compiled SSR modules export `renderToStream` / `renderInto` (streaming) and sync `render` (back-compat; awaits stay empty in the sync path).

Node (`vex start`) and `vex dev` pipe the stream without buffering the full body first.

Use for:

- Data that depends on the request (params, cookies, auth)
- Pages that must be fresh on every visit
- Large pages or slow `{#await}` regions where early bytes matter

Example: `/posts/:id` in the basic app; `/stream` demonstrates a delayed `{#await}`.

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

Return **full pathnames** (not bare param values). At `vex build`, each path runs `load` once and writes static HTML. Routes with `:params` and no `getStaticPaths` / `entries` are skipped.

### ISR: `revalidate`

By default SSG HTML is **immutable** until the next `vex build`. Set `revalidate` (seconds) on an `ssg` route for **stale-while-revalidate** regeneration in production (`vex start` / Node adapter):

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

`vex dev` does not run this disk ISR loop (pages are served via the normal request pipeline).

## CSR

Client-side rendering skips server HTML for the page body beyond the application shell. The client fetches data and renders in the browser. Guards still apply when configured.

Use for:

- App-like surfaces where server HTML for the view is optional
- Routes that are behind auth and not meant for public HTML snapshots

Example: `/admin` in the basic app.

## Mixing modes

Hybrid apps are intentional: one `routes.ts` can mix `ssg`, `ssr`, and `csr`. Choose per route rather than forcing a single strategy for the whole site.

## Build output

`vex build` produces client assets, server bundles, and SSG HTML for routes marked `ssg`. The Node adapter (`@vexjs/adapter-node`) serves the production app via `vex start`.
