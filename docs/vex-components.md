# `.vex` components

A `.vex` file is the unit of a page or layout: markup, styles, client logic, and optional server logic live together. The compiler splits client and server so server code never ships to the browser.

## Sections

| Section | Purpose |
|---------|---------|
| `<script server>` | Server-only. May export `load`, `actions`, `api_*`, etc. |
| `<script>` | Client-only. Receives props / load data; uses the runtime |
| `<style scoped>` | CSS scoped to the component (scoped is the default intent) |
| `<template>` | Markup rendered for the page |

Order of sections is flexible; keep server script clearly separated from client script.

## Server script

### `load`

Runs on the server (and during SSG) to provide data for the page:

```vex
<script server>
  export async function load({ params }) {
    return { title: `Post ${params.id}` }
  }
</script>
```

Returned fields are available as exports / props on the client script (for example `export let title`).

### `actions`

Named (or `default`) handlers for form posts. The example app uses `?_action=name`:

```vex
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

### `api_*`

HTTP handlers colocated with the route. Common pattern: `api_GET`, `api_POST`, …, often reached via a `.json` suffix or `Accept: application/json`.

```vex
<script server>
  import { json, notFound } from '@vexjs/server'

  export async function api_GET({ params }) {
    const post = lookup(params.id)
    if (!post) throw notFound()
    return json({ post })
  }
</script>
```

Absolute `api` map keys remain supported for site-root paths when you need them; prefer route-relative `api_*` for page APIs.

### Helpers

From `@vexjs/server`: `json`, `notFound`, `redirect`, `error`, and related pipeline helpers.

## Client script

```vex
<script>
  import { signal } from '@vexjs/runtime'
  export let title
  const count = signal(0)
</script>
```

- `export let …` declares inputs from `load` / parent data
- Use `signal`, `computed`, and `effect` for reactivity
- Never import server-only modules into the client script

## Template

```vex
<template>
  <h1>{title}</h1>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

Supported patterns in v1 include:

- Text and expressions: `{expr}`
- Events: `on:click={handler}` or `on:click={() => …}`
- Control flow: `{#if}` / `{:else}` / `{/if}`, `{#each}` / `{/each}`, `{#await}` / …
- Bindings: `bind:value={name}`
- Forms: `method="POST"` with actions as above

## Isolation rule

Server script must not appear in the client bundle. The compiler and tests enforce this split; keep secrets and database access only under `<script server>`.

## Full example

See [`examples/basic-app/src/pages/Post.vex`](../examples/basic-app/src/pages/Post.vex) for `load`, actions, `api_GET`, and client signals together.
