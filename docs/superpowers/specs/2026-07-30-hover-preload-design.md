# Hover / tap / viewport page preload

Updated: 2026-07-30
**Status:** Approved for implementation (2026-07-30)
**Plan:** Cursor plan `hover_page_preload` (implement in-repo under `packages/runtime`)

## Goal

Prefetch the next same-origin page’s HTML before click (SvelteKit-like), so client navigation can reuse a warm cache and feel instant.

Today `installClientRouter` only fetches on click via `navigate()`. There is no preload.

## Non-goals (v1)

- Separate JS module prefetch (HTML fetch is enough; client boot still runs)
- A dedicated `<Link>` component or compiler transforms on `<a>`
- Prefetch for form `enhance` POST/GET actions
- Abort-on-hover-leave

## Locked decisions

| Topic | Choice |
|-------|--------|
| Default | `hover` for all same-origin links |
| Modes | `hover` \| `tap` \| `viewport` \| `off` |
| Attribute | `data-avedon-preload` on link or ancestor (`html`/`body`/…) |
| Inheritance | Closest `[data-avedon-preload]`; else `hover` |
| Save-Data | `navigator.connection.saveData` or `(prefers-reduced-data: reduce)` → all preload off |
| Request | Same as navigate: `fetch(pathname+search, { headers: { accept: 'text/html' } })` |
| Cache key | `pathname + search` (no hash) |
| Cache value | In-flight `Promise<string>` then HTML string; LRU max 20 |
| After navigate | Invalidate that key after apply so the next visit refetches |
| Form enhance | Does not read the preload cache |
| Programmatic API | `preload(href)` exported from `@avedon/runtime` |

## API

```html
<!-- default: hover -->
<a href="/docs">Docs</a>

<body data-avedon-preload="viewport">
  <a href="/a">A</a>
  <a href="/b" data-avedon-preload="off">B</a>
</body>
```

```ts
import { preload, navigate } from '@avedon/runtime'

await preload('/docs/intro')
await navigate('/docs/intro')
```

### Mode triggers

| Mode | When |
|------|------|
| `hover` | `pointerover` / `focusin` after ~20ms delay; also `touchstart` on coarse pointers |
| `tap` | `touchstart` / `pointerdown` only (no hover prefetch) |
| `viewport` | `IntersectionObserver` once when the link intersects |
| `off` | Never |

### Skip rules (same as click navigation)

- External origin, `download`, `target="_blank"`, hash-only `href`
- Current page (`pathname+search` equals `location`)
- Save-Data / reduced-data (preload only)

## Architecture

- `packages/runtime/src/preload.ts` — mode resolve, Save-Data check, cache, `preload()`, `takeCachedHtml()`, `invalidatePreload()`, `__resetPreloadCache()` for tests
- `navigate()` — `takeCachedHtml` or fetch+store; `applyDocument`; `invalidatePreload`
- `installClientRouter` — wire triggers; reuse form MutationObserver scan for viewport links

## Error handling

- Failed prefetch: drop cache entry; click falls back to normal fetch
- Non-OK HTTP: still cache the body (navigate already applies whatever HTML arrives)
- Hover leave: do not abort

## Tests

- Unit: mode inheritance, Save-Data skip, dedupe, LRU, `off`, current-URL skip
- Playwright: hover fires one fetch; click uses cache (no second fetch); `off` skips hover fetch

## Docs

Expand [Client navigation](../../routing.md) with attribute modes and Save-Data behavior.
