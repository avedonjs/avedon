# Security

Practical notes for keeping avedon apps safe.

## Layout `children` / `<slot />` (trusted HTML)

Layouts receive page content through `children` / `<slot />`.

**Trusted by framework contract:**

- SSR/streaming pipeline output (child `render` / stream writers)
- A `Node` or `DocumentFragment` you built yourself and pass into `mount` / `update`

**Unsafe:**

- Passing an untrusted string (request body, query, unsanitized CMS HTML) as `children` into `mount`, `hydrate`, or `update`

Client codegen inserts string `children` via a `<template>` element's `innerHTML`. Sanitize untrusted markup **before** it becomes `children`, or pass a DOM `Node` you constructed safely (for example `document.createTextNode`).

## `{@html}` (trusted HTML)

`{@html expression}` inserts an HTML string without escaping.

**Only** use for trusted content (for example build-time markdown you control). Never pass request bodies, query strings, or unsanitized CMS HTML into `{@html}`.

## `head.html` (trusted HTML)

`head.title` and `head.description` from [`load`](./loading-data.md#page-head) are escaped, but `head.html` is injected into `<head>` verbatim — same contract as `{@html}`. Build the string from values you control; never interpolate request input into it.

## Forms and CSRF

Form `actions` use Origin/Referer same-origin checks — see [Middleware](./middleware.md). Pair with `SameSite` session cookies from [Session](./session.md).

## Scaffold middleware

The create-app template does **not** enable reflecting CORS (`origin: true`) or trust `X-Forwarded-For` for rate limits by default. Add an explicit CORS allowlist and `rateLimit({ trustForwarded: true })` only behind a trusted proxy.

## Playground mock server

Docs playground `load` / `actions` evaluation runs in a dedicated Web Worker (not on the docs page main thread), so untrusted REPL server script does not share the parent document origin’s DOM.

## Reporting vulnerabilities

Do not report vulnerabilities in public issues. See [SECURITY.md](../SECURITY.md) in the avedon repository.
