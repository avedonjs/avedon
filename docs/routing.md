# Routing

avedon uses **explicit** route tables. There is no file-based route discovery: you declare paths in `src/routes.ts` with `defineRoutes`.

## Declaring routes

| Style | When to use |
|-------|-------------|
| **`route(path, config)`** (recommended) | Path is a separate argument, so TypeScript can type `guard` callbacks as `ExtractParams<path>` |
| **Object literal `{ path, … }`** | Fully supported; param inference on inline `guard` callbacks is limited |

Page modules type their own `load` / `actions` via `LoadEvent<'/posts/:id'>` — see [Components](./components.md). Keep that path string aligned with `route('/posts/:id', …)`.

```ts
import { defineRoutes, route } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import Post from './pages/Post.ave'
import Admin from './pages/Admin.ave'
import { requireAuth } from './guards/auth'

export default defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  route('/posts/:id', {
    layout: Layout,
    component: Post,
    render: 'ssr',
    guard: (e) => Boolean(e.params.id),
  }),
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireAuth,
  },
])
```

Nested routes that need parent params in the child guard:

```ts
route('/users/:userId', {
  component: UserLayout,
  children: (r) => [
    r('posts/:postId', {
      component: UserPost,
      guard: (e) => Boolean(e.params.userId && e.params.postId),
    }),
  ],
})
```

## Route fields

| Field | Description |
|-------|-------------|
| `path` | Path pattern (`:param`, `:id?`, `*rest` / `*` supported in types) |
| `component` | Page `.ave` module |
| `layout` | Optional layout `.ave` wrapping the page |
| `render` | `'ssr'` \| `'ssg'` \| `'csr'` — see [Rendering](./rendering.md) |
| `getStaticPaths` | For `ssg` routes with params: `() => string[]` of full paths (alias: `entries`) |
| `revalidate` | Optional ISR interval in seconds for `ssg` |
| `guard` | Optional activation check (`canActivate` is an alias) |
| `error` | Optional error UI for that route |
| `notFound` | Optional 404 UI for that route |
| `children` | Nested routes (array, or `(r) => […]` when using `route()`) |

## Guards

Guards run before the route activates:

```ts
import type { LoadEvent } from '@avedon/server'

export function requireAuth(event: LoadEvent): boolean {
  return event.url.searchParams.get('auth') === '1'
}
```

Attach with `guard: requireAuth`, or an inline callback on `route('/path/:id', { guard: (e) => … })`.

For session-backed auth, prefer [`requireSession`](./session.md). For CORS, logging, and rate limits, use [Middleware](./middleware.md) instead of guards.

## Layouts

Layouts are `.ave` components that wrap child pages. Share chrome (nav, shell) via `layout` instead of duplicating markup.

Layout `children` / `<slot />` are a **trusted HTML** contract — see [Security](./security.md).

## Errors and not-found

Provide global `error.ave` / `not-found.ave` (scaffold includes both) and optional per-route `error` / `notFound` components. Prefer throwing helpers from `@avedon/server`:

- `notFound()` → **404**
- `error(status)` → that status
- Failed `guard` → **403** via the route `error` chain

## Client navigation

`@avedon/runtime` installs client-side navigation for same-origin links after the first load.

## See also

- [Rendering](./rendering.md)
- [Loading data](./loading-data.md)
- [Tutorial](./tutorial.md)
