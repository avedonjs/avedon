# create-avedon-app

## 2.0.1

### Patch Changes

- Align all publishable packages to a shared lockstep version. Changesets `fixed` group keeps them on the same version forever after (even when a package has no code changes).

## 0.2.0

### Minor Changes

- 3f0d5fe: Add `@avedon/adapter-static` for fail-closed SSG export (`build/client` only). Create-app gains `--adapter=static`; CLI manifest exposes `hasActions`/`hasApi` for the static gate.

## 0.1.3

### Patch Changes

- 939005b: Add create-app dependency sync + pack-build smoke; fix CodeQL slugify ReDoS and playground script strip.

## 0.1.2

### Patch Changes

- a1b1b6b: Align scaffold dependency ranges with published packages so `@avedon/runtime` resolves to 0.2.x (exports `__contextBegin` required by compiler 0.4).

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
