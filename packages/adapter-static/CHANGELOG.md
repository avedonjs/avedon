# @avedon/adapter-static

## 0.2.1

### Patch Changes

- Fix published dependency: replace `workspace:*` with `@avedon/shared` caret range (manual `npm publish` does not rewrite workspace protocol).

## 0.2.0

### Minor Changes

- 3f0d5fe: Add `@avedon/adapter-static` for fail-closed SSG export (`build/client` only). Create-app gains `--adapter=static`; CLI manifest exposes `hasActions`/`hasApi` for the static gate.
