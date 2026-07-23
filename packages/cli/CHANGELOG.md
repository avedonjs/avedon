# avedon

## 0.1.3

### Patch Changes

- 6e8bfb1: Release via npm Trusted Publisher (OIDC) only — no `NPM_TOKEN` fallback in CI.

## 0.1.2

### Patch Changes

- cea058d: Ship Cloudflare Workers and Bun production adapters, and fix form-action redirect URL handling plus the CSR outlet marker.

  - `@avedon/adapter-cloudflare`: Workers + static assets + `wrangler.jsonc` (SSG; ISR not on Workers yet)
  - `@avedon/adapter-bun`: `Bun.serve` with Node-parity static files, SSG, and ISR SWR
  - `@avedon/runtime`: `enhance()` boots the final URL after action redirects
  - `@avedon/server`: fix malformed `data-avedon-csr` attribute
  - `avedon`: include `revalidate` on the build manifest for adapter warnings

- Updated dependencies [cea058d]
  - @avedon/runtime@0.1.2
  - @avedon/server@0.1.2
  - @avedon/adapter-node@0.1.2
  - @avedon/vite-plugin@0.1.2

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
- Updated dependencies [a9bd2c0]
  - create-avedon-app@0.1.1
  - @avedon/runtime@0.1.1
  - @avedon/server@0.1.1
  - @avedon/vite-plugin@0.1.1
  - @avedon/adapter-node@0.1.1
