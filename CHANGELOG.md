# Changelog

All notable changes to the AVEDON monorepo are documented here.

## Unreleased

### Breaking changes

- **SSR streaming is now the default.** Every `render: 'ssr'` route streams HTML unless `bufferHtml: true` is set. Previously, the document shell was held until `load()` finished unless `earlyShell: true` was set (`earlyShell` has been removed).
- **`load()` timing vs HTTP redirects/errors:** For up to ~40ms the server waits for `load()` before sending the first byte. If `load()` finishes in that window with `redirect()`, `notFound()`, or `error()`, the response is a normal HTTP redirect or error page. If the shell is already streaming and `load()` then redirects or errors, AVEDON degrades gracefully: client-side `window.location` for redirects, route `notFound` / `error` components in the stream for errors (status remains 200 once the shell was committed — HTTP cannot change status mid-stream).

### Added

- Route option `bufferHtml: true` as the explicit SSR opt-out (replaces the old default buffered behavior and `earlyShell`).
