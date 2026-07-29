# @avedon/compiler

## 0.3.0

### Minor Changes

- cf7f470: Add `{#key}` remount blocks, keyed `{#each}`, `{#each}…{:else}` empty branches, `{@const}` locals, `{#await}` pending UI (before `{:then}` / `{:catch}`), `{#await p then v}` / `{#await p catch e}` shorthands, event modifiers (`on:click|preventDefault`, `stopImmediatePropagation`, `passive`, `nonpassive`, …), HTML comment stripping (`<!-- … -->`), boolean attribute expressions (`disabled={…}` omits when falsy), `<select bind:value>` (`change` + SSR option `selected`), `<select multiple bind:value={arr}>` (`string[]` via `selectedOptions`), numeric `bind:value` on static `type="number"` / `type="range"` (`valueAsNumber`, empty → `undefined`), `bind:files` on file inputs (client `FileList`), dimension binds (`bind:clientWidth` / `Height` / `offsetWidth` / `Height` via `ResizeObserver`), `bind:scrollTop` / `scrollLeft`, `bind:selectionStart` / `selectionEnd`, `bind:indeterminate` on checkboxes, `bind:open` on `<details>`/`<dialog>`, media binds (`muted` / `paused` / `volume` / `currentTime` / `playbackRate` / `duration` / `ended` / `seeking` / `played` / `buffered` / `seekable` / `readyState` / `networkState` / `videoWidth` / `videoHeight`), `bind:naturalWidth` / `naturalHeight` on images, `bind:textContent` / `bind:innerText` on contenteditable elements, `transition:fade` / `fly` / `slide` / `scale` / `spin` / `pop` / `blur` / `draw` plus intro-only `in:` / outro-only `out:` with optional `duration` / `delay` / `easing` (on `{#if}` / `{#each}`), reduced-motion aware timing via `transitionMs`, SVG client creation via `createElementNS` (context-aware so HTML `<title>` stays HTML), element and component spread attributes (`{...obj}`), named slots (`slot="…"` / `<slot name>` via a `slots` prop bag), `class:` / `style:` / `use:` directives on elements (including `style:--custom-property` CSS variables), `bind:checked` / `bind:group` / `bind:this` on elements, `{:else if}` branches, and nested component `.destroy()` when `{#if}` / `{#each}` / `{#key}` / `{#await}` blocks tear down.
- cf7f470: Add `transition:bounce` (and `in:bounce` / `out:bounce`) — scale + opacity with springy easing.
- cf7f470: Add `transition:drop` (and `in:drop` / `out:drop`) — scale + translateY settle from above.
- cf7f470: Add `transition:flip` / `in:flip` / `out:flip` — perspective + rotateY intro/outro.
- cf7f470: Add `transition:pulse` / `in:pulse` / `out:pulse` — overscale attention intro/outro.
- cf7f470: Add `transition:roll` / `in:roll` / `out:roll` — perspective + rotateX intro/outro.
- cf7f470: Add `transition:shake` (and `in:shake` / `out:shake`) — horizontal translateX attention motion.
- cf7f470: Add `transition:skew` / `in:skew` / `out:skew` — skewX/Y + opacity intro/outro.
- cf7f470: Add `transition:slideX` (and `in:slideX` / `out:slideX`) — horizontal width + opacity slide.
- cf7f470: Add `transition:wipe` / `in:wipe` / `out:wipe` — clip-path wipe intro/outro.
- cf7f470: Add `transition:zoom` / `in:zoom` / `out:zoom` — scale zoom intro/outro with ease-out.

### Patch Changes

- cf7f470: `{#await}` pending UI: keep the first block until `{:then}` / `{:catch}`; streaming SSR can show pending HTML inside the OOO placeholder.
- cf7f470: Register client template effects with runtime `effect()` so signal reads auto-update the DOM.
- cf7f470: Add component context: `setContext` / `getContext` / `hasContext` with `__contextBegin` frames on SSR `render` / `renderInto` and client `mount`.
- cf7f470: Add `createEventDispatcher` for component `on:` events; bare `createEventDispatcher()` is rewritten to use `__props`.
- cf7f470: Add `onMount` / `onDestroy` lifecycle hooks; client `mount()` brackets init with `__lifecycleBegin` / `__lifecycleEnd`.
- cf7f470: Soft hydrate restores focus and text selection after remount (`captureFocus` / `restoreFocus`).
- cf7f470: Soft hydrate restores form field state (`captureFormState` / `restoreFormState`) before restoring focus.
- cf7f470: Soft hydrate restores `<details>` / `<dialog>` open state (`captureOpenState` / `restoreOpenState`) after remount.
- cf7f470: Soft hydrate restores scroll offsets (`captureScrollState` / `restoreScrollState`) for elements and the window after remount.
- cf7f470: Add `transitionMs` and wire built-in transitions so duration/delay become `0` under `prefers-reduced-motion: reduce`.
- cf7f470: Add `beforeUpdate` / `afterUpdate` lifecycle hooks (wired through mount `__invalidate` and signal template effects).
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

- Updated dependencies [cea058d]
  - @avedon/runtime@0.1.2

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
- Updated dependencies [a9bd2c0]
  - @avedon/runtime@0.1.1
  - @avedon/shared@0.1.1
