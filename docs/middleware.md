# Middleware

Route-agnostic request middleware runs **before** route matching and **guards**. Use it for cross-cutting concerns such as logging, CORS, and rate limiting.

Guards (`guard` / `canActivate` / `canMatch`) stay on the route table and see `params`. Middleware never does.

## Pipeline order

1. Adapter / Vite normalizes to a Web `Request`
2. `hooks.server.ts` middleware chain (`sequence`)
3. Optional `handle` hook
4. Match routes → guards → `load` / `actions` / `api_*` / SSR

## `hooks.server.ts`

```ts
import { cors, logger, rateLimit } from '@avedon/server'

export const middleware = [
  logger(),
  rateLimit({ max: 200 }),
  cors({ origin: true }),
]

export default { middleware }
```

You can still export a single `handle` (backward compatible). When both are present, the framework runs:

`sequence(...middleware, handle)`.

## `sequence`

Compose custom onion handlers (same shape as `handle`):

```ts
import { sequence, type Middleware } from '@avedon/server'

const timing: Middleware = async ({ request, resolve }) => {
  const start = Date.now()
  const res = await resolve(request)
  console.log(`${Date.now() - start}ms`)
  return res
}

export const handle = sequence(timing, async ({ request, resolve }) => resolve(request))
```

First argument is outermost (sees the request first; can short-circuit).

## Built-ins

| Helper | Role |
|--------|------|
| `logger({ format? })` | Logs method, path, status, duration (`dev` or `short`) |
| `cors({ origin?, methods?, headers?, maxAge? })` | OPTIONS → 204; attaches CORS headers. `origin: true` reflects the request `Origin` |
| `rateLimit({ windowMs?, max?, key? })` | Process-local fixed window; over limit → `429` + `Retry-After` |

`rateLimit` uses an in-memory `Map`. It is fine for local/dev and single-instance demos. For multi-node production, supply a custom `key` and replace the helper with a shared store.

## Middleware vs guards

| | Middleware | Guard |
|--|------------|-------|
| Scope | All requests | Matched route chain |
| `params` | No | Yes |
| Typical use | CORS, logging, rate limit | Authz, “can this user open this page?” |

Do not put role checks that need route params in middleware; use `guard` on the route instead.

## CSRF for form actions

Form `actions` (`POST` with `?_action=…`) use a **same-origin check** on `Origin` (or `Referer` when `Origin` is absent), similar to SvelteKit — not a hidden CSRF token field. Browsers send `Origin` on cross-site POSTs; requests without a matching origin get **403**.

**Missing headers (fail closed):** If both `Origin` and `Referer` are absent, the request is **rejected with 403**. Some clients (scripts, older stacks, certain proxies) omit both headers; those POSTs cannot pass this check unless you disable CSRF or use a same-origin browser form (which sends at least one header). This is intentional — we do not treat “no header” as same-origin.

| Check | Applies to |
|-------|------------|
| `assertCsrf` (Origin/Referer) | Form `actions` only |
| Not applied | `api_*` / absolute API routes, GET requests |

Disable or extend via handler options: `csrf: false` or `csrf: { trustedOrigins: ['https://app.example'] }`.

Token-based double-submit CSRF is intentionally out of scope for v1; rely on `SameSite` cookies plus Origin for session-backed apps.
