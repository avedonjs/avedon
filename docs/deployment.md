# Deployment

Production today targets **Node** via `@avedon/adapter-node`.

## Build and run

From your app directory:

```bash
pnpm build
pnpm start
```

This runs `avedon build` then `avedon start` (preview is an alias of start). The adapter writes output under the directory configured in `avedon.config.ts` (default `build`).

Ensure production env vars are set (for example `SESSION_SECRET` if you use sessions).

## What gets built

- Client assets
- Server bundles
- Static HTML for routes marked `ssg` (plus ISR behavior when `revalidate` is set — see [Rendering](./rendering.md))

## Hosting tips

- Run `avedon start` behind your process manager or platform (systemd, Docker, Fly, Railway, etc.)
- Serve over HTTPS in production so session cookies get the `Secure` flag
- Put a reverse proxy in front if you need TLS termination or static CDN caching of assets

## Other platforms

Bun and Cloudflare adapters are **stubs** today — not ready for production deploy guides. Prefer Node until those adapters ship.

Static marketing sites that are entirely `ssg` can still be built with avedon and served as static files from `build` client output where applicable (the public docs site itself is an SSG example). Mixed SSR apps need the Node server.

## See also

- [Quick start](./quick-start.md)
- [Configuration](./configuration.md)
- [Rendering](./rendering.md)
