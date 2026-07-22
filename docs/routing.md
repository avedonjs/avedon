# Routing

avedon uses **explicit** route tables. There is no file-based route discovery: you declare paths in `src/routes.ts` with `defineRoutes`.

## Declaring routes

Two styles are supported; neither is deprecated.

| Style | When to use |
|-------|-------------|
| **`route(path, config)`** (recommended for new code) | Path is a separate argument, so TypeScript can type `guard` / load contexts as `ExtractParams<path>` (e.g. `params.id: string`). |
| **Object literal `{ path, … }`** | Still fully supported at runtime. Convenient for static routes; **param inference on inline `guard` callbacks is limited** (TS cannot contextual-type the callback from `path` inside the same object). |

Page modules type their own `load` / `actions` via `LoadEvent<'/posts/:id'>` (or `LoadContext<{ … }>`) in `<script server>` — see [Typing load, params, and actions](./avedon-components.md#typing-load-params-and-actions). Keep that path string aligned with `route('/posts/:id', …)`.

```ts
import { defineRoutes, route } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import Post from './pages/Post.ave'
import Admin from './pages/Admin.ave'
import AdminError from './pages/AdminError.ave'
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
    // e.params.id is string
    guard: (e) => Boolean(e.params.id),
  }),
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireAuth, // separately typed via LoadEvent / LoadContext
    error: AdminError,
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

Inside a `.ave` `<script server>` block, type `load` / `actions` with `LoadEvent<'/posts/:id'>` the same way (path is not known from `routes.ts` alone).

## Route fields

| Field | Description |
|-------|-------------|
| `path` | Path pattern (`:param`, `:id?`, `*rest` / `*` supported in types) |
| `component` | Page `.ave` module |
| `layout` | Optional layout `.ave` wrapping the page |
| `render` | `'ssr'` \| `'ssg'` \| `'csr'` (see [Rendering](./rendering.md)) |
| `getStaticPaths` | For `ssg` routes with params: `() => string[]` of full paths (alias: `entries`) |
| `revalidate` | Optional ISR interval in seconds for `ssg` (stale-while-revalidate; see [Rendering](./rendering.md)) |
| `guard` | Optional activation check (`canActivate` is an alias) |
| `error` | Optional error UI for that route (also used when `error()` is thrown in `load` / actions) |
| `notFound` | Optional 404 UI for that route (also used when `notFound()` is thrown) |
| `children` | Nested routes (array, or `(r) => […]` when using `route()`) |

## Guards

Guards run before the route activates. Return or resolve in a way that allows navigation, or deny / redirect according to your guard implementation.

```ts
// examples/basic-app/src/guards/auth.ts
import type { LoadEvent } from '@avedon/server'

export function requireAuth(event: LoadEvent): boolean {
  return event.url.searchParams.get('auth') === '1'
}
```

Attach with `guard: requireAuth` on the route entry, or an inline callback on `route('/path/:id', { guard: (e) => … })`.

For cross-cutting concerns (logging, CORS, rate limits) that are not route-specific, use [Middleware](./middleware.md) instead of guards.

## Layouts

Layouts are `.ave` components that wrap child pages. Share chrome (nav, shell) via `layout` instead of duplicating markup in every page.

Layout `children` / `<slot />` are a **trusted HTML** contract — see [Security](./security.md).

## Errors and not-found

Apps can provide global and per-route error / not-found `.ave` modules (see `examples/basic-app/src/error.ave` and `not-found.ave`). Prefer throwing helpers such as `notFound()` or `error(status)` from `@avedon/server` inside `load` or actions:

- `notFound()` → status **404** and the nearest route `notFound` (else global `notFoundComponent`)
- `error(status)` → that status and the nearest route `error` (else global `errorComponent`)
- Failed `guard` / `canActivate` → **403** via the route `error` chain

## Client navigation

`@avedon/runtime` installs client-side navigation for same-origin links so transitions stay in-app after the first load. Forms can be progressively enhanced with the runtime helpers.

## Reference implementation

[`examples/basic-app/src/routes.ts`](../examples/basic-app/src/routes.ts) is the canonical example used by smoke and e2e tests.
