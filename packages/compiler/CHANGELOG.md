# @avedon/compiler

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

- Updated dependencies [cea058d]
  - @avedon/runtime@0.1.2

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
- Updated dependencies [a9bd2c0]
  - @avedon/runtime@0.1.1
  - @avedon/shared@0.1.1
