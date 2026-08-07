# Deployment

Production targets **Node** (`@avedon/adapter-node`), **Static** (`@avedon/adapter-static`), **Cloudflare Workers** (`@avedon/adapter-cloudflare`), or **Bun** (`@avedon/adapter-bun`).

Scaffold with `pnpm create avedon-app my-app --adapter=static` (or `cloudflare` / `bun`) to wire the matching adapter at create time — see [CLI](./cli.md).

## Static

Use `@avedon/adapter-static` for fully static hosts (Cloudflare Pages, Netlify, GitHub Pages, S3/CDN).

### Config

```ts
import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({
    out: 'build',
    notFoundHtml: true, // writes client/404.html
    redirects: 'cloudflare', // stub _redirects if public/_redirects is absent
  }),
}
```

### Build and deploy

```bash
pnpm build
# deploy the build/client directory
wrangler pages deploy ./build/client --project-name=my-app
```

### Limits

- **Only `render: 'ssg'`** — SSR, CSR, form `actions`, `api` / `api_*`, and `revalidate` cause a hard build failure.
- No Node/Bun/Workers runtime; there is nothing to `avedon start`.

The docs site (`apps/www`) builds with `@avedon/adapter-cloudflare` (Workers+Assets dogfood) and still deploys `build/client` to Cloudflare Pages for [avedon.pages.dev](https://avedon.pages.dev).

## Node

### Build and run

From your app directory:

```bash
pnpm build
pnpm start
```

This runs `avedon build` then `avedon start` (preview is an alias of start). The adapter writes output under the directory configured in `avedon.config.ts` (default `build`).

Ensure production env vars are set (for example `SESSION_SECRET` if you use sessions).

### What gets built

- Client assets
- Server bundles
- Static HTML for routes marked `ssg` (plus ISR when `revalidate` is set — see [Rendering](./rendering.md))

### ISR and on-demand revalidation

Node supports stale-while-revalidate via route `revalidate` and on-demand regeneration via `revalidatePath(pathname, ctx, { wait? })` from `@avedon/adapter-node` (call from an `action` / `api_*` with `clientDir`, `routes`, and `appHtml`). Paths that were never built at `avedon build` are not created. Bun mirrors this API; **Cloudflare Workers do not**.

### Hosting tips

- Run `avedon start` behind your process manager or platform (systemd, Docker, Fly, Railway, etc.)
- Serve over HTTPS in production so session cookies get the `Secure` flag
- Put a reverse proxy in front if you need TLS termination or static CDN caching of assets

## Cloudflare Workers

Use `@avedon/adapter-cloudflare` for edge SSR with Workers Static Assets.

### Config

```ts
import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'my-avedon-app' }),
}
```

### Build and deploy

```bash
pnpm build
cd build && wrangler deploy
```

Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 4+ and a Cloudflare account. The adapter writes a self-contained `build/` tree: `client/` (assets + SSG HTML), `server/`, `worker.js`, and `wrangler.jsonc` (`nodejs_compat`, `ASSETS` binding).

### Sessions

```bash
wrangler secret put SESSION_SECRET
```

If your `server-entry` exports `session` without a `secret`, the generated Worker uses `env.SESSION_SECRET`.

### Limits (v1)

- **ISR / `revalidate` / `revalidatePath`:** not supported on Workers — SSG HTML is static until the next deploy. Prefer **Node** or **Bun** if you need stale-while-revalidate or on-demand regeneration today.
- This adapter targets **Workers + Assets**, not Pages Functions. Prefer `@avedon/adapter-static` for fully static SSG sites on Pages.

## Bun

Use `@avedon/adapter-bun` for a `Bun.serve` production server with Node-parity static files, SSG, and ISR (stale-while-revalidate).

### Config

```ts
import { bunAdapter } from '@avedon/adapter-bun'

export default {
  adapter: bunAdapter({ out: 'build' }),
}
```

### Build and run

```bash
pnpm build
bun run build/server.js
```

Requires [Bun](https://bun.sh/). Set `PORT` to change the listen port (default `3000`). `avedon start` remains Node-oriented (`build/server.js` via Node); use `bun` explicitly for this adapter.

### Sessions

Provide `SESSION_SECRET` in the environment (same rules as Node).

### Behavior

- Static assets under `build/client` with path-traversal guards
- SSG HTML on disk; `revalidate` uses SWR background regeneration
- Other requests go through `createHandler` (SSR streaming, actions, APIs)

## See also

- [Quick start](./quick-start.md)
- [Configuration](./configuration.md)
- [Rendering](./rendering.md)
