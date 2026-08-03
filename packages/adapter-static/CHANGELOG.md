# @avedon/adapter-static

## 2.0.1

### Patch Changes

- Align all publishable packages to a shared lockstep version. Changesets `fixed` group keeps them on the same version forever after (even when a package has no code changes).
- Updated dependencies
  - @avedon/shared@2.0.1

## 0.2.1

### Patch Changes

- Fix published dependency: replace `workspace:*` with `@avedon/shared` caret range (manual `npm publish` does not rewrite workspace protocol).

## 0.2.0

### Minor Changes

- 3f0d5fe: Add `@avedon/adapter-static` for fail-closed SSG export (`build/client` only). Create-app gains `--adapter=static`; CLI manifest exposes `hasActions`/`hasApi` for the static gate.
