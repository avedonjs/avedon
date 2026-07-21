# Rendering modes

Each route selects how HTML is produced via the `render` field on `defineRoutes`.

| Mode | When HTML is produced | Typical use |
|------|----------------------|-------------|
| `ssr` | On each request | Dynamic, personalized, or frequently changing data |
| `ssg` | At `vex build` | Mostly static marketing or content pages |
| `csr` | In the browser | Highly interactive shells after a minimal boot |

Default when unspecified: **`ssr`**.

## SSR

Server-side rendering runs `load` (and related pipeline steps) per request, then sends HTML that the client hydrates.

Use for:

- Data that depends on the request (params, cookies, auth)
- Pages that must be fresh on every visit

Example: `/posts/:id` in the basic app.

## SSG

Static generation runs at build time. The resulting HTML is served as a static asset (still hydrates on the client when needed).

Use for:

- Pages whose data is known at build time
- Fast first paint for stable content

Example: `/` home page in the basic app.

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
