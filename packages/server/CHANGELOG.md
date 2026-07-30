# @avedon/server

## 0.2.7

### Patch Changes

- 7f88e40: Mirror `head.title` / `head.description` into `og:*` and `twitter:*` meta tags so social crawlers (especially X) get a complete card without relying on `<title>` / `meta name=description` fallbacks alone.

## 0.2.6

### Patch Changes

- Updated dependencies [427e102]
  - @avedon/runtime@0.3.0

## 0.2.5

### Patch Changes

- Updated dependencies [939005b]
  - @avedon/runtime@0.2.2

## 0.2.4

### Patch Changes

- 6d9d01f: Link Vite-extracted client CSS in SSG/SSR shells so imports like CodeMirror styles load in production.

## 0.2.3

### Patch Changes

- d324875: Playground dogfood: signal-script transform, compiler/runtime fixes, session write chain.
- Updated dependencies [d324875]
  - @avedon/runtime@0.2.1

## 0.2.2

### Patch Changes

- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
- Updated dependencies [cf7f470]
  - @avedon/runtime@0.2.0

## 0.2.1

### Patch Changes

- 0304df9: Harden codegen and per-page head against CodeQL findings: component prop keys/values now use `\u003c`-safe literals (js/bad-code-sanitization), and the document `<title>` / `<meta name="description">` replacements use linear scanning instead of backtracking regexes (js/polynomial-redos).

## 0.2.0

### Minor Changes

- 5ba9db4: Add reusable `.ave` component composition (PascalCase tags, props, default slots, fail-closed unsupported syntax) and per-page document head from `load` (`head: { title, description, html }` with streaming `awaitHead`).

### Patch Changes

- Updated dependencies [5ba9db4]
  - @avedon/shared@0.2.0

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

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
- Updated dependencies [a9bd2c0]
  - @avedon/runtime@0.1.1
  - @avedon/shared@0.1.1
