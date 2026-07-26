# avedon

## 0.1.5

### Patch Changes

- Updated dependencies [0304df9]
  - @avedon/server@0.2.1
  - @avedon/vite-plugin@0.1.4
  - @avedon/adapter-node@0.1.4

## 0.1.4

### Patch Changes

- 5ba9db4: Add reusable `.ave` component composition (PascalCase tags, props, default slots, fail-closed unsupported syntax) and per-page document head from `load` (`head: { title, description, html }` with streaming `awaitHead`).
- Updated dependencies [5ba9db4]
  - @avedon/server@0.2.0
  - @avedon/vite-plugin@0.1.3
  - @avedon/adapter-node@0.1.3

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
