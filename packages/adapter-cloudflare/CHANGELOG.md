# @avedon/adapter-cloudflare

## 2.0.1

### Patch Changes

- Align all publishable packages to a shared lockstep version. Changesets `fixed` group keeps them on the same version forever after (even when a package has no code changes).
- Updated dependencies
  - @avedon/server@2.0.1
  - @avedon/shared@2.0.1

## 0.2.9

### Patch Changes

- Updated dependencies [7952e61]
  - @avedon/server@0.2.8

## 0.2.8

### Patch Changes

- Updated dependencies [7f88e40]
  - @avedon/server@0.2.7

## 0.2.7

### Patch Changes

- @avedon/server@0.2.6

## 0.2.6

### Patch Changes

- @avedon/server@0.2.5

## 0.2.5

### Patch Changes

- 6d9d01f: Link Vite-extracted client CSS in SSG/SSR shells so imports like CodeMirror styles load in production.
- Updated dependencies [6d9d01f]
  - @avedon/server@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies [d324875]
  - @avedon/server@0.2.3

## 0.2.3

### Patch Changes

- @avedon/server@0.2.2

## 0.2.2

### Patch Changes

- Updated dependencies [0304df9]
  - @avedon/server@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [5ba9db4]
  - @avedon/shared@0.2.0
  - @avedon/server@0.2.0

## 0.2.0

### Minor Changes

- cea058d: Ship Cloudflare Workers and Bun production adapters, and fix form-action redirect URL handling plus the CSR outlet marker.

  - `@avedon/adapter-cloudflare`: Workers + static assets + `wrangler.jsonc` (SSG; ISR not on Workers yet)
  - `@avedon/adapter-bun`: `Bun.serve` with Node-parity static files, SSG, and ISR SWR
  - `@avedon/runtime`: `enhance()` boots the final URL after action redirects
  - `@avedon/server`: fix malformed `data-avedon-csr` attribute
  - `avedon`: include `revalidate` on the build manifest for adapter warnings

### Patch Changes

- Updated dependencies [cea058d]
  - @avedon/server@0.1.2

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
- Updated dependencies [a9bd2c0]
  - @avedon/shared@0.1.1
