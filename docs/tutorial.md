# Tutorial

Build a small notes-style page: a list route with server `load`, a detail route with a param, and a form action that increments a counter. Start from a scaffolded app ([Quick start](./quick-start.md)).

## 1. Add routes

Edit `src/routes.ts`:

```ts
import { defineRoutes, route } from '@avedon/server'
import Home from './pages/Home.ave'
import Notes from './pages/Notes.ave'
import Note from './pages/Note.ave'

export const routes = defineRoutes([
  { path: '/', component: Home, render: 'ssr' },
  { path: '/notes', component: Notes, render: 'ssr' },
  route('/notes/:id', {
    component: Note,
    render: 'ssr',
  }),
])

export default routes
```

Prefer `route('/notes/:id', …)` so TypeScript can type `params` in guards and you stay aligned with typed `load` handlers.

## 2. List page with `load`

Create `src/pages/Notes.ave`:

```avedon
<script server>
  export async function load() {
    return {
      data: {
        notes: [
          { id: '1', title: 'Hello' },
          { id: '2', title: 'World' },
        ],
      },
    }
  }
</script>

<script>
  export let data
</script>

<template>
  <h1>Notes</h1>
  <ul>
    {#each data.notes as note}
      <li><a href={'/notes/' + note.id}>{note.title}</a></li>
    {/each}
  </ul>
</template>
```

`load` runs on the server. Returned `data` is available on the client as `export let data`.

## 3. Detail page with params and an action

Create `src/pages/Note.ave`:

```avedon
<script server>
  import { type LoadEvent, notFound } from '@avedon/server'

  const titles: Record<string, string> = {
    '1': 'Hello',
    '2': 'World',
  }

  export async function load({
    params,
  }: LoadEvent<'/notes/:id'>): Promise<{ data: { id: string; title: string; likes: number } }> {
    const title = titles[params.id]
    if (!title) throw notFound()
    return { data: { id: params.id, title, likes: 0 } }
  }

  export const actions = {
    async like({ params }: LoadEvent<'/notes/:id'>) {
      return { ok: true, id: params.id }
    },
  }
</script>

<script>
  export let data
</script>

<template>
  <p><a href="/notes">← Notes</a></p>
  <h1>{data.title}</h1>
  <p>id: {data.id}</p>
  <form method="POST" action="?_action=like">
    <button type="submit">Like</button>
  </form>
</template>
```

Visit `/notes` and `/notes/1`. Submit the form — avedon posts to the same route with `?_action=like` and runs the named action (CSRF-protected; see [Loading data](./loading-data.md)).

## 4. Optional: client signal

Add a local counter on the detail page:

```avedon
<script>
  import { signal } from '@avedon/runtime'
  export let data
  const clicks = signal(0)
</script>

<template>
  <!-- … -->
  <button type="button" on:click={() => clicks.set(clicks.get() + 1)}>
    Local clicks: {clicks}
  </button>
</template>
```

## What you learned

| Piece | Where |
|-------|--------|
| Route table | `routes.ts` + `route()` |
| Server data | `load` in `<script server>` |
| Forms | `actions` + `?_action=` |
| Params | `LoadEvent<'/notes/:id'>` |
| Client state | `signal` from `@avedon/runtime` |

## Next steps

- [Components](./components.md) — full `.ave` format
- [Routing](./routing.md) — layouts, guards, errors
- [Rendering](./rendering.md) — `ssr` / `ssg` / `csr`
- [Session](./session.md) — cookies and auth-style guards
