# Loading data

Server code in a `.ave` file provides data for the page, handles form posts, and can expose JSON APIs — all colocated with the UI.

## `load`

Runs on the server (and during SSG) to provide data:

```avedon
<script server>
  export async function load({ params }) {
    return { data: { title: `Post ${params.id}` } }
  }
</script>

<script>
  export let data
</script>
```

Prefer returning `{ data: T }` so generated types flow to `export let data`. Helpers from `@avedon/server`: `json`, `notFound`, `redirect`, `error`.

## Page head

`load` may return a `head` object next to `data` to control the document head for that page:

```avedon
<script server>
  import { notFound, type HeadMeta, type LoadEvent } from '@avedon/server'

  export async function load({ params }: LoadEvent<'/posts/:id'>): Promise<{
    data: { post: Post }
    head: HeadMeta
  }> {
    const post = await getPost(params.id)
    if (!post) throw notFound()
    return {
      data: { post },
      head: { title: `${post.title} — avedon`, description: post.excerpt },
    }
  }
</script>
```

| Field | Effect |
|-------|--------|
| `title` | Replaces `<title>` (HTML-escaped) |
| `description` | Replaces or adds `<meta name="description">` (HTML-escaped) |
| `html` | Raw **trusted** HTML appended to `<head>` — same contract as `{@html}`, see [Security](./security.md) |

Without `head.title` the `<title>` from `src/app.html` stays. Client-side navigations pick the new title up from the fetched document.

Streaming SSR routes must opt in with `awaitHead: true` so the shell waits for `load()`; `ssg`, `csr`, and `bufferHtml` routes need no flag. See [Rendering](./rendering.md#awaithead-true).

## `actions`

Named (or `default`) handlers for form posts. Use `?_action=name`:

```avedon
<script server>
  export const actions = {
    async like({ params }) {
      return { ok: true }
    },
  }
</script>

<template>
  <form method="POST" action="?_action=like">
    <button type="submit">Like</button>
  </form>
</template>
```

Form actions are protected by a same-origin **CSRF** check (Origin, or Referer if Origin is absent). Cross-site POSTs get `403`. There is no hidden CSRF token in v1 — see [Middleware — CSRF](./middleware.md). Disable with `csrf: false` on the handler options, or allow extra origins via `csrf: { trustedOrigins: ['https://app.example'] }`.

## `api_*`

HTTP handlers colocated with the route. Common pattern: `api_GET`, `api_POST`, …, often reached via a `.json` suffix or `Accept: application/json`.

```avedon
<script server>
  import { json, notFound } from '@avedon/server'

  export async function api_GET({ params }) {
    const post = lookup(params.id)
    if (!post) throw notFound()
    return json({ post })
  }
</script>
```

Absolute `api` map keys remain supported for site-root paths when you need them; prefer route-relative `api_*` for page APIs.

## Typed handlers

```avedon
<script server>
  import { type LoadEvent } from '@avedon/server'

  export async function load({
    params,
  }: LoadEvent<'/posts/:id'>): Promise<{ data: { id: string } }> {
    return { data: { id: params.id } }
  }

  export const actions = {
    async save({ params, formData }: LoadEvent<'/posts/:id'>) {
      return { ok: true }
    },
  }
</script>
```

## See also

- [Components](./components.md) — `.ave` sections and typing overview
- [Session](./session.md) — cookies on the same `LoadEvent`
- [Security](./security.md) — trusted HTML and `{@html}`
