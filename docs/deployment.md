# Deployment

Production targets **Node** (`@avedon/adapter-node`) or **Cloudflare Workers** (`@avedon/adapter-cloudflare`).

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
- Static HTML for routes marked `ssg` (plus ISR behavior when `revalidate` is set — see [Rendering](./rendering.md))

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

- **ISR / `revalidate`:** not supported on Workers — SSG HTML is static until the next deploy. Prefer Node if you need stale-while-revalidate today.
- This adapter targets **Workers + Assets**, not Pages Functions. Fully static SSG sites can still be published to Pages from client HTML alone (as with the public docs site).

## Bun

`@avedon/adapter-bun` remains a stub.

## See also

- [Quick start](./quick-start.md)
- [Configuration](./configuration.md)
- [Rendering](./rendering.md)
