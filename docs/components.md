# Components

A `.ave` file is a **page**, **layout**, or reusable **UI component**: markup, styles, client logic, and (for pages/layouts) server logic live together. The compiler splits client and server so server code never ships to the browser.

## Sections

| Section | Purpose |
|---------|---------|
| `<script server>` | Server-only. May export `load`, `actions`, `api_*`, etc. |
| `<script>` | Client-only. Receives props / load data; uses the runtime |
| `<style scoped>` | CSS scoped to the component |
| `<template>` | Markup rendered for the page |

Order of sections is flexible; keep server script clearly separated from client script.

## Client script

```avedon
<script>
  import { signal } from '@avedon/runtime'
  export let title
  const count = signal(0)
</script>
```

- `export let …` declares inputs from `load` / parent data
- Use `signal`, `computed`, and `effect` for reactivity — see [Reactivity](./reactivity.md)
- Never import server-only modules into the client script

## Typing load, params, and actions

Generated `*.ave.d.ts` files type `Props` (including inferred `data` from `load`), `mount` / `render` props, and server handlers.

Annotate `load` with `LoadEvent<'/posts/:id'>` (path pattern) or `LoadContext<{ id: string }>`. Keep that path string aligned with `route('/posts/:id', …)` in `routes.ts`.

```avedon
<script server>
  import { type LoadEvent, notFound } from '@avedon/server'

  export async function load({
    params,
  }: LoadEvent<'/posts/:id'>): Promise<{ data: { id: string } }> {
    if (!params.id) throw notFound()
    return { data: { id: params.id } }
  }
</script>
```

For `load`, `actions`, and `api_*` details, see [Loading data](./loading-data.md). Prefer `route('/posts/:id', { guard: (e) => … })` so `e.params` is typed in [Routing](./routing.md).

## Template

```avedon
<template>
  <h1>{title}</h1>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

Supported patterns include:

- Text and expressions: `{expr}`
- Trusted HTML: `{@html htmlString}` — unescaped; see [Security](./security.md)
- Events: `on:click={handler}` or `on:click={() => …}`
- Control flow: `{#if}` / `{:else}` / `{/if}`, `{#each}` / `{/each}`, `{#await}` / …
- Bindings: `bind:value={name}`
- Forms: `method="POST"` with [actions](./loading-data.md)

## Using components

Import another `.ave` file and use it as a **PascalCase** tag. The import must be a default import whose name matches the tag, or compilation fails.

```avedon
<script>
  import Counter from './Counter.ave'
</script>
<template>
  <Counter start={3} />
</template>
```

- **Props:** attributes become props — `start={3}` (dynamic) or `label="hi"` (static). `export let` in the component declares them.
- **Events:** `on:click={handler}` on a component becomes an `onclick` prop the component can wire to the DOM (`export let onclick` + `on:click={onclick}`). There is no event dispatcher in v1.
- **Default slot:** children between the tags fill the component's `<slot />` (`children` prop; see [Security](./security.md) for the trusted-HTML contract).

UI components are presentational: they cannot declare `<script server>` / `load` / `actions`. Keep server logic in the route page or layout.

Not supported in v1 (fails at compile time with a clear message): named slots, `bind:` on components, `class:` / `style:` / `transition:` / `use:` directives, `{@const}`, `{#key}`, keyed `{#each}`, and spread attributes.

## Isolation rule

Server script must not appear in the client bundle. Keep secrets and database access only under `<script server>`.

## See also

- [Loading data](./loading-data.md)
- [Reactivity](./reactivity.md)
- [Tutorial](./tutorial.md)
