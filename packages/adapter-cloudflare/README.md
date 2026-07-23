# @avedon/adapter-cloudflare

Cloudflare Workers adapter for avedon. Emits a Wrangler-deployable `build/` directory: static assets + SSG HTML, SSR Worker entry, and `wrangler.jsonc`.

## Config

```ts
import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'my-avedon-app' }),
}
```

## Build and deploy

```bash
pnpm build          # avedon build → build/
cd build && wrangler deploy
```

Requires Wrangler 4+ and a Cloudflare account.

### Sessions

Set the Worker secret:

```bash
wrangler secret put SESSION_SECRET
```

If `server-entry` exports `session` without `secret`, the generated Worker fills `secret` from `env.SESSION_SECRET`.

## Limits (v1)

- **ISR / `revalidate`:** not supported on Workers — SSG HTML is fixed until the next deploy.
- Pages Functions are not used; this adapter targets Workers + Assets.
