# Reactivity

Client interactivity in avedon uses `@avedon/runtime`: `signal`, `computed`, and `effect`.

## Signals

```avedon
<script>
  import { signal } from '@avedon/runtime'
  const count = signal(0)
</script>

<template>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

- Read with `count.get()` or by interpolating `{count}` in the template
- Write with `count.set(next)`
- Template effects are registered with runtime `effect()`, so signal writes re-render bound DOM without an extra event/`__invalidate` (plain `let` bindings still need events or `update()`)

### `tweened`

```avedon
<script>
  import { tweened } from '@avedon/runtime'
  const n = tweened(0, { duration: 200 })
</script>

<template>
  <button type="button" on:click={() => n.set(100)}>Go</button>
  <p>{Math.round(n.get())}</p>
</template>
```

Number signal that animates toward `set` / `update` targets with `requestAnimationFrame`. Options: `duration` (default `400`, clamped by `transitionMs`) and `easing`. Pass `{ duration: 0 }` to jump. Register during component init so frames cancel on destroy.

### `spring`

```avedon
<script>
  import { spring } from '@avedon/runtime'
  const n = spring(0, { stiffness: 0.2, damping: 0.7 })
</script>

<template>
  <button type="button" on:click={() => n.set(100)}>Go</button>
  <p>{Math.round(n.get())}</p>
</template>
```

Number signal that springs toward `set` / `update` targets. Options: `stiffness` (default `0.15`), `damping` (default `0.8`), `precision` (default `0.01`), and `hard` to jump. Under reduced motion, sets are hard. Register during component init so frames cancel on destroy.

## Computed and effect

```ts
import { signal, computed, effect, untrack, batch } from '@avedon/runtime'

const count = signal(0)
const other = signal(1)
const doubled = computed(() => count.get() * 2)

effect(() => {
  // re-runs when `count` changes; `other` is sampled without subscribing
  console.log(count.get(), untrack(() => other.get()))
})

batch(() => {
  count.set(1)
  other.set(2)
})
```

Use `effect` for side effects that should re-run when dependencies change. Prefer deriving UI with `computed` instead of duplicating state. `untrack(fn)` runs `fn` without collecting signal dependencies for the current `effect`. `batch(fn)` defers effect notifications until `fn` returns so multiple writes only re-run dependents once. `readonly(signal)` exposes the same reads/subscriptions while rejecting `set` / `update` (underlying writes still propagate).

### `mediaQuery`

```avedon
<script>
  import { mediaQuery } from '@avedon/runtime'
  const narrow = mediaQuery('(max-width: 700px)')
</script>

<template>
  <p>{narrow.get() ? 'narrow' : 'wide'}</p>
</template>
```

Read-only signal synced to `window.matchMedia`. Call it during component init (top-level `<script>`) so the listener is removed on destroy. SSR starts as `false`.

### `prefersReducedMotion`

```avedon
<script>
  import { prefersReducedMotion } from '@avedon/runtime'
  const reduced = prefersReducedMotion()
</script>

<template>
  <p>{reduced.get() ? 'reduce' : 'no-preference'}</p>
</template>
```

Convenience for `mediaQuery('(prefers-reduced-motion: reduce)')`. Same lifecycle rules as `mediaQuery`.

### `prefersColorScheme`

```avedon
<script>
  import { prefersColorScheme } from '@avedon/runtime'
  const scheme = prefersColorScheme()
</script>

<template>
  <p>{scheme.get()}</p>
</template>
```

Read-only `'light' | 'dark'` signal from `(prefers-color-scheme: dark)`. Same lifecycle rules as `mediaQuery`. SSR starts as `'light'`.

### `prefersContrast`

```avedon
<script>
  import { prefersContrast } from '@avedon/runtime'
  const more = prefersContrast()
</script>

<template>
  <p>{more.get() ? 'more' : 'no-preference'}</p>
</template>
```

Convenience for `mediaQuery('(prefers-contrast: more)')`. Same lifecycle rules as `mediaQuery`.

### `prefersReducedTransparency`

```avedon
<script>
  import { prefersReducedTransparency } from '@avedon/runtime'
  const reduced = prefersReducedTransparency()
</script>

<template>
  <p>{reduced.get() ? 'reduce' : 'no-preference'}</p>
</template>
```

Convenience for `mediaQuery('(prefers-reduced-transparency: reduce)')`. Same lifecycle rules as `mediaQuery`.

### `prefersReducedData`

```avedon
<script>
  import { prefersReducedData } from '@avedon/runtime'
  const reduced = prefersReducedData()
</script>

<template>
  <p>{reduced.get() ? 'reduce' : 'no-preference'}</p>
</template>
```

Convenience for `mediaQuery('(prefers-reduced-data: reduce)')`. Same lifecycle rules as `mediaQuery`.

### `saveDataSignal`

```avedon
<script>
  import { saveDataSignal } from '@avedon/runtime'
  const save = saveDataSignal()
</script>

<template>
  <p>{save.get() ? 'on' : 'off'}</p>
</template>
```

Read-only signal for `navigator.connection.saveData` (Network Information API). Updates on the connection `change` event when available. SSR / unsupported environments start as `false`. Call during component init so the listener is removed on destroy.

### `connectionEffectiveType`

```avedon
<script>
  import { connectionEffectiveType } from '@avedon/runtime'
  const type = connectionEffectiveType()
</script>

<template>
  <p>{type.get() || 'unknown'}</p>
</template>
```

Read-only signal for `navigator.connection.effectiveType` (`'4g'` / `'3g'` / `'2g'` / `'slow-2g'`). Updates on the connection `change` event when available. SSR / unsupported environments start as `''`. Call during component init so the listener is removed on destroy.

### `connectionDownlink`

```avedon
<script>
  import { connectionDownlink } from '@avedon/runtime'
  const mbps = connectionDownlink()
</script>

<template>
  <p>{mbps}</p>
</template>
```

Read-only signal for `navigator.connection.downlink` (estimated Mbps). Updates on the connection `change` event when available. SSR / unsupported environments start as `0`. Call during component init so the listener is removed on destroy.

### `connectionRtt`

```avedon
<script>
  import { connectionRtt } from '@avedon/runtime'
  const rtt = connectionRtt()
</script>

<template>
  <p>{rtt}</p>
</template>
```

Read-only signal for `navigator.connection.rtt` (estimated round-trip time in ms). Updates on the connection `change` event when available. SSR / unsupported environments start as `0`. Call during component init so the listener is removed on destroy.

### `forcedColors`

```avedon
<script>
  import { forcedColors } from '@avedon/runtime'
  const forced = forcedColors()
</script>

<template>
  <p>{forced.get() ? 'active' : 'none'}</p>
</template>
```

Convenience for `mediaQuery('(forced-colors: active)')`. Same lifecycle rules as `mediaQuery`.

### `invertedColors`

```avedon
<script>
  import { invertedColors } from '@avedon/runtime'
  const inverted = invertedColors()
</script>

<template>
  <p>{inverted.get() ? 'inverted' : 'none'}</p>
</template>
```

Convenience for `mediaQuery('(inverted-colors: inverted)')`. Same lifecycle rules as `mediaQuery`.

### `transitionMs`

```ts
import { transitionMs } from '@avedon/runtime'

transitionMs(200) // → 0 when (prefers-reduced-motion: reduce) matches
```

Clamps transition timing for built-in `transition:` / `in:` / `out:` directives (compiler wires this automatically). Returns `0` under reduced motion; otherwise the given non-negative duration.

### `windowSize`

```avedon
<script>
  import { windowSize } from '@avedon/runtime'
  const size = windowSize()
</script>

<template>
  <p>{size.get().width}×{size.get().height}</p>
</template>
```

Read-only signal of `window.innerWidth` / `innerHeight`. Register during component init so the `resize` listener is removed on destroy. SSR starts as `{ width: 0, height: 0 }`.

### `pageScroll`

```avedon
<script>
  import { pageScroll } from '@avedon/runtime'
  const scroll = pageScroll()
</script>

<template>
  <p>{scroll.get().y}</p>
</template>
```

Read-only signal of `window.scrollX` / `scrollY` (passive `scroll` listener). Register during component init so cleanup runs on destroy. SSR starts as `{ x: 0, y: 0 }`.

### `devicePixelRatio`

```avedon
<script>
  import { devicePixelRatio } from '@avedon/runtime'
  const dpr = devicePixelRatio()
</script>

<template>
  <p>{dpr}</p>
</template>
```

Read-only signal of `window.devicePixelRatio` (updates on `resize`). Register during component init so cleanup runs on destroy. SSR starts as `1`.

### `persistedSignal`

```avedon
<script>
  import { persistedSignal } from '@avedon/runtime'
  const name = persistedSignal('my-app:name', 'guest')
  const draft = persistedSignal('my-app:draft', '', { storage: 'session' })
</script>

<template>
  <p>{name}</p>
  <button type="button" on:click={() => name.set('ada')}>Save</button>
</template>
```

JSON-backed signal (`localStorage` by default, or `sessionStorage` via `{ storage: 'session' }`). SSR uses `fallback`; the client re-reads storage on mount. Cross-tab updates apply via the `storage` event for local storage when registered during component init.

### `onlineSignal`

```avedon
<script>
  import { onlineSignal } from '@avedon/runtime'
  const online = onlineSignal()
</script>

<template>
  <p>{online.get() ? 'online' : 'offline'}</p>
</template>
```

Read-only signal for `navigator.onLine`, updated on `online` / `offline`. SSR defaults to `true`. Call during component init so listeners are removed on destroy.

### `nowSignal`

```avedon
<script>
  import { nowSignal } from '@avedon/runtime'
  const now = nowSignal({ interval: 1000 })
</script>

<template>
  <p>{now}</p>
</template>
```

Read-only signal of `Date.now()`, updated every `interval` ms (default `1000`). Call during component init so the timer is cleared on destroy.

### `idleSignal`

```avedon
<script>
  import { idleSignal } from '@avedon/runtime'
  const idle = idleSignal({ timeout: 60_000 })
</script>

<template>
  <p>{idle.get() ? 'idle' : 'active'}</p>
</template>
```

Read-only signal that becomes `true` after `timeout` ms without user activity (default `60_000`; listens for pointer/keyboard/scroll on `window`). Call during component init so listeners/timers are cleared on destroy.

### `localeSignal`

```avedon
<script>
  import { localeSignal } from '@avedon/runtime'
  const locale = localeSignal()
</script>

<template>
  <p>{locale.get()}</p>
</template>
```

Read-only signal of `navigator.language`, updated on `languagechange`. Call during component init so the listener is removed on destroy.

### `localesSignal`

```avedon
<script>
  import { localesSignal } from '@avedon/runtime'
  const locales = localesSignal()
</script>

<template>
  <p>{locales.get().join(', ')}</p>
</template>
```

Read-only signal of `navigator.languages` (preferred locales, most preferred first), updated on `languagechange`. Call during component init so the listener is removed on destroy.

### `timeZoneSignal`

```avedon
<script>
  import { timeZoneSignal } from '@avedon/runtime'
  const timeZone = timeZoneSignal()
</script>

<template>
  <p>{timeZone.get()}</p>
</template>
```

Read-only signal of the host IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `hardwareConcurrencySignal`

```avedon
<script>
  import { hardwareConcurrencySignal } from '@avedon/runtime'
  const cores = hardwareConcurrencySignal()
</script>

<template>
  <p>{cores.get()}</p>
</template>
```

Read-only signal of `navigator.hardwareConcurrency` (logical CPU cores). Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `deviceMemorySignal`

```avedon
<script>
  import { deviceMemorySignal } from '@avedon/runtime'
  const mem = deviceMemorySignal()
</script>

<template>
  <p>{mem.get()}</p>
</template>
```

Read-only signal of `navigator.deviceMemory` (approximate device RAM in GiB; `0` when unsupported). Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `userAgentSignal`

```avedon
<script>
  import { userAgentSignal } from '@avedon/runtime'
  const ua = userAgentSignal()
</script>

<template>
  <p>{ua.get()}</p>
</template>
```

Read-only signal of `navigator.userAgent`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `doNotTrackSignal`

```avedon
<script>
  import { doNotTrackSignal } from '@avedon/runtime'
  const dnt = doNotTrackSignal()
</script>

<template>
  <p>{dnt.get()}</p>
</template>
```

Read-only signal of `navigator.doNotTrack`, normalized to `'1' | '0' | 'unspecified'`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `vendorSignal`

```avedon
<script>
  import { vendorSignal } from '@avedon/runtime'
  const vendor = vendorSignal()
</script>

<template>
  <p>{vendor.get()}</p>
</template>
```

Read-only signal of `navigator.vendor`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `appVersionSignal`

```avedon
<script>
  import { appVersionSignal } from '@avedon/runtime'
  const ver = appVersionSignal()
</script>

<template>
  <p>{ver.get()}</p>
</template>
```

Read-only signal of `navigator.appVersion`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `productSignal`

```avedon
<script>
  import { productSignal } from '@avedon/runtime'
  const product = productSignal()
</script>

<template>
  <p>{product.get()}</p>
</template>
```

Read-only signal of `navigator.product`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `appNameSignal`

```avedon
<script>
  import { appNameSignal } from '@avedon/runtime'
  const name = appNameSignal()
</script>

<template>
  <p>{name.get()}</p>
</template>
```

Read-only signal of `navigator.appName`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `platformSignal`

```avedon
<script>
  import { platformSignal } from '@avedon/runtime'
  const platform = platformSignal()
</script>

<template>
  <p>{platform.get()}</p>
</template>
```

Read-only signal of `navigator.platform`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `appCodeNameSignal`

```avedon
<script>
  import { appCodeNameSignal } from '@avedon/runtime'
  const code = appCodeNameSignal()
</script>

<template>
  <p>{code.get()}</p>
</template>
```

Read-only signal of `navigator.appCodeName`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `maxTouchPointsSignal`

```avedon
<script>
  import { maxTouchPointsSignal } from '@avedon/runtime'
  const points = maxTouchPointsSignal()
</script>

<template>
  <p>{points.get()}</p>
</template>
```

Read-only signal of `navigator.maxTouchPoints`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `cookieEnabledSignal`

```avedon
<script>
  import { cookieEnabledSignal } from '@avedon/runtime'
  const cookies = cookieEnabledSignal()
</script>

<template>
  <p>{cookies.get() ? 'yes' : 'no'}</p>
</template>
```

Read-only signal of `navigator.cookieEnabled`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `pdfViewerEnabledSignal`

```avedon
<script>
  import { pdfViewerEnabledSignal } from '@avedon/runtime'
  const pdf = pdfViewerEnabledSignal()
</script>

<template>
  <p>{pdf.get() ? 'yes' : 'no'}</p>
</template>
```

Read-only signal of `navigator.pdfViewerEnabled`. Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `webdriverSignal`

```avedon
<script>
  import { webdriverSignal } from '@avedon/runtime'
  const webdriver = webdriverSignal()
</script>

<template>
  <p>{webdriver.get() ? 'yes' : 'no'}</p>
</template>
```

Read-only signal of `navigator.webdriver` (automation / controlled browser). Re-reads on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `storageEstimateSignal`

```avedon
<script>
  import { storageEstimateSignal } from '@avedon/runtime'
  const estimate = storageEstimateSignal()
</script>

<template>
  <p>{estimate.get()?.usage}/{estimate.get()?.quota}</p>
</template>
```

Read-only signal of `navigator.storage.estimate()` (`usage` / `quota` bytes). Starts as `null` until resolved; refreshes on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `storagePersistedSignal`

```avedon
<script>
  import { storagePersistedSignal } from '@avedon/runtime'
  const persisted = storagePersistedSignal()
</script>

<template>
  <p>{persisted.get() == null ? 'pending' : persisted.get() ? 'yes' : 'no'}</p>
</template>
```

Read-only signal of `navigator.storage.persisted()`. Starts as `null` until resolved; refreshes on `visibilitychange` / `focus`. Call during component init so listeners are removed on destroy.

### `hashSignal`

```avedon
<script>
  import { hashSignal } from '@avedon/runtime'
  const hash = hashSignal()
</script>

<template>
  <button type="button" on:click={() => hash.set('#docs')}>Docs</button>
  <p>{hash.get() || 'none'}</p>
</template>
```

Writable signal synced with `location.hash` (including `#`, or `''`). Updates on `hashchange`; `set` / `update` assign `location.hash`. SSR starts as `''`. Call during component init so the listener is removed on destroy.

### `searchParamsSignal`

```avedon
<script>
  import { searchParamsSignal } from '@avedon/runtime'
  const search = searchParamsSignal()
</script>

<template>
  <button type="button" on:click={() => search.set('q=1')}>Filter</button>
  <p>{search.get() || 'none'}</p>
</template>
```

Writable signal synced with `location.search` (including `?`, or `''`). Updates on `popstate` and patched `history.pushState` / `replaceState`; `set` / `update` use `history.replaceState` (no reload). A value without `?` is normalized. SSR starts as `''`. Call during component init so listeners are removed on destroy.

### `pathnameSignal`

```avedon
<script>
  import { pathnameSignal } from '@avedon/runtime'
  const path = pathnameSignal()
</script>

<template>
  <button type="button" on:click={() => path.set('/about')}>About</button>
  <p>{path.get()}</p>
</template>
```

Writable signal synced with `location.pathname`. Updates on `popstate` and patched `history.pushState` / `replaceState`; `set` / `update` use `pushState`. SSR starts as `'/'`. Call during component init so listeners are removed on destroy.

### `documentTitleSignal`

```avedon
<script>
  import { documentTitleSignal } from '@avedon/runtime'
  const title = documentTitleSignal()
</script>

<template>
  <button type="button" on:click={() => title.set('About')}>Set</button>
  <p>{title.get()}</p>
</template>
```

Writable signal synced with `document.title`. Writes update `document.title`; a `MutationObserver` keeps the signal in sync if the `<title>` node changes. SSR starts as `''`. Call during component init so the observer is removed on destroy.

### `htmlLangSignal`

```avedon
<script>
  import { htmlLangSignal } from '@avedon/runtime'
  const lang = htmlLangSignal()
</script>

<template>
  <button type="button" on:click={() => lang.set('tr')}>TR</button>
  <p>{lang.get()}</p>
</template>
```

Writable signal synced with `document.documentElement.lang`. Writes update the `<html lang>` attribute; a `MutationObserver` keeps the signal in sync if the attribute changes externally. SSR starts as `''`. Call during component init so the observer is removed on destroy.

### `htmlDirSignal`

```avedon
<script>
  import { htmlDirSignal } from '@avedon/runtime'
  const dir = htmlDirSignal()
</script>

<template>
  <button type="button" on:click={() => dir.set('rtl')}>RTL</button>
  <p>{dir.get()}</p>
</template>
```

Writable signal synced with `document.documentElement.dir` (`'ltr'` / `'rtl'` / `''`). Writes update the `<html dir>` attribute; a `MutationObserver` keeps the signal in sync if the attribute changes externally. SSR starts as `''`. Call during component init so the observer is removed on destroy.

### `visibilitySignal`

```avedon
<script>
  import { visibilitySignal } from '@avedon/runtime'
  const visibility = visibilitySignal()
</script>

<template>
  <p>{visibility}</p>
</template>
```

Read-only signal for `document.visibilityState` (`'visible'` / `'hidden'` / …), updated on `visibilitychange`. SSR defaults to `'visible'`. Call during component init so the listener is removed on destroy.

### `activeElement`

```avedon
<script>
  import { activeElement } from '@avedon/runtime'
  const focused = activeElement()
</script>

<template>
  <p>{focused.get()?.tagName ?? 'none'}</p>
</template>
```

Read-only signal for `document.activeElement`, updated on `focusin` / `focusout`. SSR defaults to `null`. Call during component init so listeners are removed on destroy.

## Lifecycle

```avedon
<script>
  import { onMount, onDestroy } from '@avedon/runtime'

  onMount(() => {
    const id = setInterval(() => {}, 1000)
    return () => clearInterval(id)
  })

  onDestroy(() => {
    // always runs when the component instance is destroyed
  })
</script>
```

- `onMount` / `onDestroy` schedule work only during client `mount()` initialization; they are no-ops during SSR.
- `onMount` callbacks run on a microtask after the DOM is built; they may return a cleanup that runs on destroy.
- `pageTitle(title)` sets `document.title` during client mount init (string or signal-reading getter) and restores the previous title on destroy; no-op during SSR.
- `beforeUpdate` / `afterUpdate` register during mount init: `beforeUpdate` runs before subsequent DOM flushes (not before the first render); `afterUpdate` runs after every flush including the initial render.
- Prefer signals + template bindings for reactive UI; use lifecycle hooks for DOM APIs, timers, and subscriptions.
- `await tick()` from `@avedon/runtime` resolves after pending component DOM updates (useful after mutating plain `let` state in an async handler before reading the DOM).
- `setContext(key, value)` / `getContext(key)` / `hasContext(key)` / `getAllContexts()` share values down the component tree during init (SSR `render` and client `mount`). Call them at the top level of a component `<script>`, not inside event handlers. `getAllContexts()` returns a `Map` of all ancestor (and own) entries; child values overwrite the same key.

## Forms and navigation

`@avedon/runtime` installs client-side navigation for same-origin links after the first load. Forms that post to `actions` can be progressively enhanced by the runtime helpers.

## Rules of thumb

- Keep mutable UI state in signals on the client
- Keep secrets, DB access, and auth decisions in `<script server>` ([Loading data](./loading-data.md))
- Do not import server modules into the client script

## See also

- [Components](./components.md)
- [Tutorial](./tutorial.md)
