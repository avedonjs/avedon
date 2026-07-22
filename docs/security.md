# Security notes

## Layout `children` / `<slot />` (trusted HTML)

avedon layouts receive page content through `children` / `<slot />`.

**Trusted sources (safe by framework contract):**

- SSR/streaming pipeline output (child `render` / stream writers)
- A `Node` or `DocumentFragment` you built yourself and pass into `mount` / `update`

**Unsafe:**

- Passing an untrusted string (for example request body, query, CMS HTML you have not sanitized) as `children` into `mount`, `hydrate`, or `update`

Client codegen inserts string `children` via a `<template>` element's `innerHTML`. That path intentionally trusts the string. If you need to render untrusted markup, sanitize it with a dedicated HTML sanitizer **before** it becomes `children`, or pass a DOM `Node` you constructed safely (for example `document.createTextNode`).

Normal client boot only remounts the leaf page into `[data-avedon-page]`; it does not remount layouts with string `children`. The footgun is the public per-component `mount` / `update` API.

## Reporting vulnerabilities

Do not report vulnerabilities in public issues. See [SECURITY.md](../SECURITY.md).
