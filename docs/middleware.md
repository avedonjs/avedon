# Middleware

Route-agnostic request middleware runs **before** route matching and **guards**. Use it for logging, CORS, and rate limiting.

Guards stay on the route table and see `params`. Middleware never does.

## Pipeline order

1. Adapter / Vite normalizes to a Web `Request`
2. `hooks.server.ts` middleware chain (`sequence`)
3. Optional `handle` hook
4. Match routes → guards → `load` / `actions` / `api_*` / SSR

## `hooks.server.ts`

The scaffold includes this file. Typical setup:

```ts
import { logger, rateLimit } from '@avedon/server'

export const middleware = [
  logger(),
  rateLimit({ max: 200 }),
  // Optional: cors({ origin: 'https://your.app' }) — avoid origin: true in production
]

export default { middleware }
```

You can still export a single `handle` (backward compatible). When both are present, the framework runs `sequence(...middleware, handle)`.

## `sequence`

Compose custom onion handlers:

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
| `cors({ origin?, methods?, headers?, maxAge? })` | OPTIONS → 204; CORS headers. Prefer an explicit origin allowlist over `origin: true` (reflects any `Origin`) |
| `rateLimit({ windowMs?, max?, key?, trustForwarded? })` | Process-local fixed window; over limit → `429` + `Retry-After` |

`rateLimit` uses an in-memory `Map` — fine for local/dev and single-instance demos. For multi-node production, use a shared store.

**Forwarded IP:** the default key is a single `anon` bucket. Set `trustForwarded: true` only behind a reverse proxy you control (`cf-connecting-ip` / `x-forwarded-for`); clients can spoof `X-Forwarded-For` on a directly exposed process.
## Middleware vs guards

| | Middleware | Guard |
|--|------------|-------|
| Scope | All requests | Matched route chain |
| `params` | No | Yes |
| Typical use | CORS, logging, rate limit | Authz, “can this user open this page?” |

## CSRF for form actions

Form `actions` (`POST` with `?_action=…`) use a **same-origin check** on `Origin` (or `Referer` when `Origin` is absent). Requests without a matching origin get **403**.

**Missing headers (fail closed):** If both `Origin` and `Referer` are absent, the request is rejected with 403.

| Check | Applies to |
|-------|------------|
| Origin/Referer CSRF | Form `actions` only |
| Not applied | `api_*`, GET requests |

Disable or extend via handler options: `csrf: false` or `csrf: { trustedOrigins: ['https://app.example'] }`.

## See also

- [Routing — Guards](./routing.md)
- [Session](./session.md)
- [Loading data](./loading-data.md)
