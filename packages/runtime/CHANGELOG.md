# @avedon/runtime

## 0.2.2

### Patch Changes

- 939005b: Add create-app dependency sync + pack-build smoke; fix CodeQL slugify ReDoS and playground script strip.

## 0.2.1

### Patch Changes

- d324875: Playground dogfood: signal-script transform, compiler/runtime fixes, session write chain.

## 0.2.0

### Minor Changes

- cf7f470: Add `activeElement()` — a read-only signal for `document.activeElement`.
- cf7f470: Add `use:alphanumeric` — keep only letters and digits while typing.
- cf7f470: Add `appCodeNameSignal()` for `navigator.appCodeName`.
- cf7f470: Add `appNameSignal()` for `navigator.appName`.
- cf7f470: Add `appVersionSignal()` for `navigator.appVersion`.
- cf7f470: Add `use:ascii` — keep printable ASCII while typing.
- cf7f470: Add `autoHeight` — a `use:` action that grows a textarea to fit its content on input.
- cf7f470: Add `autofocus` — a `use:` action that focuses an element after mount.
- cf7f470: Add `batch(fn)` to coalesce signal effect notifications across multiple writes.
- cf7f470: Add `use:beforeinput` — an InputEvent handler for IME-aware insert/delete.
- cf7f470: Add `use:camelCase` — convert words to camelCase on blur.
- cf7f470: Add `use:capitalize` — title-case words in an input/textarea on blur.
- cf7f470: Add `use:change` — a committed-value handler for `change` events.
- cf7f470: Add `clickOutside` — a `use:` action that runs a handler on pointerdown outside the element.
- cf7f470: Add `use:collapseWhitespace` — collapse whitespace runs and trim on blur.
- cf7f470: Add `use:composition` — IME composition start/update/end reporter.
- cf7f470: Add `connectionDownlink()` — a read-only signal for `navigator.connection.downlink` (Mbps).
- cf7f470: Add `connectionEffectiveType()` — a read-only signal for `navigator.connection.effectiveType`.
- cf7f470: Add `connectionRtt()` — a read-only signal for `navigator.connection.rtt` (ms).
- cf7f470: Add `use:constantCase` — convert words to CONSTANT_CASE on blur.
- cf7f470: Add component context: `setContext` / `getContext` / `hasContext` with `__contextBegin` frames on SSR `render` / `renderInto` and client `mount`.
- cf7f470: Add `use:contextmenu` — a context-menu handler action (preventDefault by default).
- cf7f470: Add `cookieEnabledSignal()` — a read-only signal for `navigator.cookieEnabled`.
- cf7f470: Add `copy` — a `use:` action that writes text to the clipboard on click.
- cf7f470: Add `use:creditCard` — keep digits, spaces, and hyphens while typing.
- cf7f470: Add `use:currency` — optional `$`, digits, and at most one `.` while typing.
- cf7f470: Add `cut` — a `use:` action that reads cut plain text (with selection fallback) and calls a handler.
- cf7f470: Add `use:cvv` — keep up to 4 digits for card security codes while typing.
- cf7f470: Add `use:dblclick` — a double-click handler action.
- cf7f470: Add `debounce` — a `use:` action that calls a handler with the control value after input settles.
- cf7f470: Add `use:decimal` — keep digits and at most one decimal point while typing.
- cf7f470: Add `deviceMemorySignal()` for approximate device RAM (`navigator.deviceMemory`).
- cf7f470: Add `devicePixelRatio()` — read-only signal of `window.devicePixelRatio`, cleaned up on destroy when registered during mount init.
- cf7f470: Add `doNotTrackSignal()` for normalized `navigator.doNotTrack`.
- cf7f470: Add `documentTitleSignal()` — a writable signal synced with `document.title`.
- cf7f470: Add `use:dotCase` — convert words to dot.case on blur.
- cf7f470: Add `download` — a `use:` action that saves a file to disk on click.
- cf7f470: Add `drag` — a `use:` action that reports pointer drag start/move/end with deltas.
- cf7f470: Add `dropzone` — a `use:` action that accepts file drops onto an element.
- cf7f470: Add `use:email` — keep email-friendly characters and lowercase while typing.
- cf7f470: Add `escapeKey` — a `use:` action that runs a handler when Escape is pressed.
- cf7f470: Add `createEventDispatcher` for component `on:` events; bare `createEventDispatcher()` is rewritten to use `__props`.
- cf7f470: Add `use:expiry` — format card expiry as MM/YY while typing.
- cf7f470: Add `focusTrap` — a `use:` action that traps Tab focus inside an element (with optional autofocus).
- cf7f470: Add `focusVisible` — a `use:` action that toggles a class (and optional handler) for `:focus-visible` keyboard focus.
- cf7f470: Add `focusWithin` — a `use:` action that reports whether focus is inside an element subtree.
- cf7f470: Add `use:focus` — report whether the element itself is focused.
- cf7f470: Add `forcedColors()` — read-only signal for `(forced-colors: active)`.
- cf7f470: Add `use:formdata` — handler for the form `formdata` event when `FormData` is built.
- cf7f470: Add `fullscreen` — a `use:` action that toggles the Fullscreen API on click.
- cf7f470: Add `getAllContexts()` — snapshot Map of ancestor and own context entries during init.
- cf7f470: Add `hardwareConcurrencySignal()` — a read-only signal for `navigator.hardwareConcurrency`.
- cf7f470: Add `hashSignal()` — a signal synced with `location.hash`.
- cf7f470: Add `use:hex` — keep optional `#` plus hex digits while typing.
- cf7f470: Add `holdRepeat` — a `use:` action that fires on pointerdown and repeats while the pointer is held.
- cf7f470: Add `hotkey` — a `use:` action for document keydown shortcuts with optional modifiers.
- cf7f470: Add `hover` — a `use:` action that reports pointer enter/leave hover state.
- cf7f470: Add `htmlDirSignal()` — a writable signal synced with `document.documentElement.dir`.
- cf7f470: Add `htmlLangSignal()` — a writable signal synced with `document.documentElement.lang`.
- cf7f470: Add `use:iban` — keep IBAN characters and uppercase while typing.
- cf7f470: Add `idleSignal()` — a read-only signal that becomes true after a period without user activity.
- cf7f470: Add `inView` — a `use:` action backed by `IntersectionObserver` (optional `once` / root options).
- cf7f470: Add `infiniteScroll` — a `use:` action that calls a handler when a scrollable element is near its bottom.
- cf7f470: Add `use:initials` — convert words to initials on blur.
- cf7f470: Add `use:input` — a live `input` event value handler.
- cf7f470: Add `use:integer` — keep optional `-` plus digits while typing.
- cf7f470: Add `use:invalid` — a constraint-validation `invalid` event handler.
- cf7f470: Add `invertedColors()` — read-only signal for `(inverted-colors: inverted)`.
- cf7f470: Add `use:kebabCase` — convert words to kebab-case on blur.
- cf7f470: Add `keydown` — a `use:` action that runs a key handler on the focused element (same options as `hotkey`).
- cf7f470: Add `keyup` — a `use:` action that runs a key handler on key release (same options as `keydown`).
- cf7f470: Add `lazy` — a `use:` action that copies `data-src` to `src` when an element enters the viewport.
- cf7f470: Add `use:letters` — keep only letters while typing.
- cf7f470: Add `onMount` / `onDestroy` lifecycle hooks; client `mount()` brackets init with `__lifecycleBegin` / `__lifecycleEnd`.
- cf7f470: Add `localeSignal()` — a read-only signal for `navigator.language`.
- cf7f470: Add `localesSignal()` — a read-only signal for `navigator.languages`.
- cf7f470: Add `lockScroll` — a `use:` action that locks document scroll while active (refcount-safe).
- cf7f470: Add `longPress` — a `use:` action that runs a handler after the pointer is held on an element.
- cf7f470: Add `use:lowercase` — lowercase input/textarea value on blur.
- cf7f470: Add `use:maxLength` — clamp input/textarea length while typing.
- cf7f470: Add `maxTouchPointsSignal()` — a read-only signal for `navigator.maxTouchPoints`.
- cf7f470: Add `mediaQuery(query)` — read-only signal synced to `window.matchMedia`, cleaned up on component destroy when registered during mount init.
- cf7f470: Add `mutate` — a `use:` action that observes DOM mutations via MutationObserver.
- cf7f470: Add `nowSignal()` — a read-only signal of `Date.now()` that ticks on an interval.
- cf7f470: Add `use:numeric` — keep only digits in an input as the user types.
- cf7f470: Add `onlineSignal()` — read-only signal for `navigator.onLine`, updated on `online` / `offline` events.
- cf7f470: Add `use:otp` — keep up to 6 digits for one-time codes while typing.
- cf7f470: Add `pageScroll()` — read-only signal of `scrollX`/`scrollY`, cleaned up on destroy when registered during mount init.
- cf7f470: Add `pageTitle()` — set `document.title` during mount init and restore it on destroy.
- cf7f470: Add `use:pascalCase` — convert words to PascalCase on blur.
- cf7f470: Add `paste` — a `use:` action that reads pasted plain text and calls a handler.
- cf7f470: Add `use:pathCase` — convert words to path/case on blur.
- cf7f470: Add `pathnameSignal()` — a signal synced with `location.pathname`.
- cf7f470: Add `pdfViewerEnabledSignal()` — a read-only signal for `navigator.pdfViewerEnabled`.
- cf7f470: Add `use:percent` — digits, one `.`, and optional trailing `%` while typing.
- cf7f470: Add `persistedSignal(key, fallback, opts?)` — JSON `localStorage`-backed signal (optional `{ storage: 'session' }`) with cross-tab `storage` sync for local storage.
- cf7f470: Add `use:phone` — keep phone-friendly characters while typing.
- cf7f470: Add `use:pin` — keep up to 4 digits for PIN entry while typing.
- cf7f470: Add `pinch` — a `use:` action that reports two-pointer pinch scale.
- cf7f470: Add `platformSignal()` for `navigator.platform`.
- cf7f470: Add `portal` — a `use:` action that moves an element into a host (selector or node; default `body`).
- cf7f470: Add `use:postalCode` — keep postal-code characters and uppercase while typing.
- cf7f470: Add `prefersColorScheme()` — read-only `'light' | 'dark'` signal for `(prefers-color-scheme: dark)`.
- cf7f470: Add `prefersContrast()` — read-only signal for `(prefers-contrast: more)`.
- cf7f470: Add `prefersReducedData()` — read-only signal for `(prefers-reduced-data: reduce)`.
- cf7f470: Add `prefersReducedMotion()` — read-only signal for `(prefers-reduced-motion: reduce)`.
- cf7f470: Add `prefersReducedTransparency()` — read-only signal for `(prefers-reduced-transparency: reduce)`.
- cf7f470: Add `pressed` — a `use:` action that toggles a class (and optional handler) while the pointer is down.
- cf7f470: Add `productSignal()` for `navigator.product`.
- cf7f470: Add `readonly(signal)` — expose a signal without `set` / `update` while keeping reactive reads.
- cf7f470: Add `use:removeDiacritics` — remove accent marks while typing.
- cf7f470: Add `use:removePunct` — strip punctuation while typing.
- cf7f470: Add `use:removeWhitespace` — strip all whitespace on blur.
- cf7f470: Add `use:reset` — a form reset event handler.
- cf7f470: Add `resize` — a `use:` action that observes element size via ResizeObserver.
- cf7f470: Add `reveal` — a `use:` action that toggles a CSS class when an element enters the viewport.
- cf7f470: Add `use:reverse` — reverse the current value on blur.
- cf7f470: Add `saveDataSignal()` — a read-only signal for `navigator.connection.saveData`.
- cf7f470: Add `scrollIntoView` — a `use:` action that scrolls an element into view when enabled.
- cf7f470: Add `use:scroll` — report element `scrollLeft` / `scrollTop` on scroll.
- cf7f470: Add `scrollspy` — a `use:` action that reports which watched section is most in view.
- cf7f470: Add `searchParamsSignal()` — a signal synced with `location.search`.
- cf7f470: Add `selectOnFocus` — a `use:` action that selects an input/textarea's contents when it receives focus.
- cf7f470: Add `use:selectionchange` — report input/textarea selection ranges.
- cf7f470: Add `use:sentenceCase` — uppercase the first letter and lowercase the rest on blur.
- cf7f470: Add `use:signedDecimal` — optional `-`, digits, and at most one `.` while typing.
- cf7f470: Add `use:slugify` — turn input/textarea value into a URL slug on blur.
- cf7f470: Add `use:snakeCase` — convert words to snake_case on blur.
- cf7f470: Add `use:snap` — CSS scroll-snap helper for a container and its children.
- cf7f470: Soft hydrate restores focus and text selection after remount (`captureFocus` / `restoreFocus`).
- cf7f470: Soft hydrate restores form field state (`captureFormState` / `restoreFormState`) before restoring focus.
- cf7f470: Soft hydrate restores `<details>` / `<dialog>` open state (`captureOpenState` / `restoreOpenState`) after remount.
- cf7f470: Soft hydrate restores scroll offsets (`captureScrollState` / `restoreScrollState`) for elements and the window after remount.
- cf7f470: Add `spring()` — a number signal that springs toward `set` targets.
- cf7f470: Add `sticky` — a `use:` action that reports when a sticky element is stuck.
- cf7f470: Add `storageEstimateSignal()` — a read-only signal for `navigator.storage.estimate()`.
- cf7f470: Add `storagePersistedSignal()` — a read-only signal for `navigator.storage.persisted()`.
- cf7f470: Add `use:submit` — a form submit handler with FormData (preventDefault by default).
- cf7f470: Add `use:swapCase` — invert letter casing on blur.
- cf7f470: Add `swipe` — a `use:` action that detects pointer swipe direction on an element.
- cf7f470: Add `throttle` — a `use:` action that calls a handler with the control value at most once per wait interval.
- cf7f470: Add `tick()` — Promise that resolves after pending component DOM updates (double microtask, after `__invalidate` flush).
- cf7f470: Add `timeZoneSignal()` — a read-only signal for the host IANA time zone.
- cf7f470: Add `tooltip` — a `use:` action that shows a lightweight tip on hover/focus.
- cf7f470: Add `use:trainCase` — convert words to Train-Case on blur.
- cf7f470: Add `transitionMs` and wire built-in transitions so duration/delay become `0` under `prefers-reduced-motion: reduce`.
- cf7f470: Add `use:trimEnd` — trim trailing whitespace on blur.
- cf7f470: Add `use:trimStart` — trim leading whitespace on blur.
- cf7f470: Add `use:trim` — trim input/textarea value on blur.
- cf7f470: Add `tweened()` — a number signal that interpolates toward `set` targets.
- cf7f470: Add `untrack(fn)` — read signals inside an effect without subscribing to them.
- cf7f470: Add `beforeUpdate` / `afterUpdate` lifecycle hooks (wired through mount `__invalidate` and signal template effects).
- cf7f470: Add `use:uppercase` — uppercase input/textarea value on blur.
- cf7f470: Add `use:url` — keep URL-friendly characters while typing.
- cf7f470: Add `userAgentSignal()` for `navigator.userAgent`.
- cf7f470: Add `use:username` — keep handle-friendly characters and lowercase while typing.
- cf7f470: Add `vendorSignal()` for `navigator.vendor`.
- cf7f470: Add `visibilitySignal()` — read-only signal for `document.visibilityState`, updated on `visibilitychange`.
- cf7f470: Add `webdriverSignal()` — a read-only signal for `navigator.webdriver`.
- cf7f470: Add `use:wheel` — a wheel / trackpad scroll handler action.
- cf7f470: Add `windowSize()` — read-only signal of `innerWidth`/`innerHeight`, cleaned up on destroy when registered during mount init.

### Patch Changes

- cf7f470: `{#await}` pending UI: keep the first block until `{:then}` / `{:catch}`; streaming SSR can show pending HTML inside the OOO placeholder.
- cf7f470: Client navigation moves `#app` children with `replaceChildren` instead of an `innerHTML` round-trip.
- cf7f470: Make `searchParamsSignal()` follow patched `history.pushState` / `replaceState` (same as `pathnameSignal`), not only `popstate`.

## 0.1.2

### Patch Changes

- cea058d: Ship Cloudflare Workers and Bun production adapters, and fix form-action redirect URL handling plus the CSR outlet marker.

  - `@avedon/adapter-cloudflare`: Workers + static assets + `wrangler.jsonc` (SSG; ISR not on Workers yet)
  - `@avedon/adapter-bun`: `Bun.serve` with Node-parity static files, SSG, and ISR SWR
  - `@avedon/runtime`: `enhance()` boots the final URL after action redirects
  - `@avedon/server`: fix malformed `data-avedon-csr` attribute
  - `avedon`: include `revalidate` on the build manifest for adapter warnings

## 0.1.1

### Patch Changes

- a9bd2c0: Initial public release of the avedon framework packages.
