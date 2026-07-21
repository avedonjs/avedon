# Cookie / sealed session helpers

Güncelleme: 2026-07-21  
**Status:** Implemented (2026-07-21)

## Goal

Official **cookie** and **sealed session** helpers so apps do not reinvent cookie parse/set and signed session cookies. Integrate with existing **guards** via `requireSession`, without building a full auth product.

## Non-goals

- Login, OAuth, passwords, or user stores
- Server-side session store (Redis, DB, opaque session ids)
- General `locals` / request context bag
- Flash messages, rolling refresh, multi-cookie chunking
- New package (`@avedon/session`); lives in `@avedon/server`

## Architecture

Thin cookies + `HandlerOptions.session` (approach 1).

| Piece | Responsibility |
|-------|----------------|
| `Cookies` | Parse `Cookie` header; queue `Set-Cookie` (`get` / `set` / `delete`) |
| Sealed session | Web Crypto AES-GCM encrypt/decrypt of JSON payload in one cookie |
| `event.cookies` | Always on `LoadContext` / `LoadEvent` |
| `event.session` | Present only when `HandlerOptions.session` is configured |
| `requireSession` | Guard factory: missing session → redirect or 403 |
| `attachCookies` | Merge outbound cookies onto final `Response` |

Pipeline order (unchanged except event enrichment + response cookie merge):

1. Adapter / Vite → Web `Request`
2. Middleware / `handle` (`sequence`)
3. Build `event`: `params`, `request`, `url`, `cookies`, optional `session`
4. Match → `canMatch` / `guard` → load / actions / api / SSR
5. Before return: attach queued `Set-Cookie` headers (including session set/destroy)

**Boundaries**

| Layer | Sees cookies/session? | Role |
|-------|----------------------|------|
| Middleware | Only via raw `request` headers (no `event`) | Cross-cutting; not session API surface |
| Guard / load / actions / api | `event.cookies`, optional `event.session` | Authn check + read/write session |

No `locals`. Session is explicit and typed on the event.

## Types

Extend `LoadContext` in `@avedon/shared` so server guards/load/actions share one shape. Client `GuardEvent` in `@avedon/runtime` stays separate (params / url / optional request only) — it does **not** gain `cookies` or `session` (httpOnly sealed cookies are not readable in JS).

```ts
cookies: Cookies
session?: Session<Record<string, unknown>>
```

```ts
type CookieSerializeOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

type Cookies = {
  get(name: string): string | undefined
  getAll(): Record<string, string>
  set(name: string, value: string, opts?: CookieSerializeOptions): void
  delete(name: string, opts?: CookieSerializeOptions): void
}

type Session<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** Unsealed payload, or `null` if missing / expired / tampered. */
  data: T | null
  /** Queues sealed Set-Cookie and updates `data` in-memory for the rest of this request. */
  set(data: T): void
  /** Queues cookie deletion and sets `data` to `null` for the rest of this request. */
  destroy(): void
}
```

Practical limit: sealed cookie value must stay under **4096** bytes; `session.set` throws if the encoded value would exceed that (no chunking in v1).

## Config

```ts
// HandlerOptions
session?: {
  secret: string
  name?: string       // default 'avedon_session'
  maxAge?: number     // seconds; default 60 * 60 * 24 * 7
  cookie?: CookieSerializeOptions
}
```

- If `session` is set and `secret` is missing or shorter than **32 characters**, `createHandler` throws a clear `Error` at setup time.
- Cookie defaults when writing session cookie: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: true` when request URL is `https:` (else `false` unless overridden).

## Seal format (Web Crypto only)

- Derive AES-256 key: `SHA-256(UTF-8(secret))` → 32-byte key (deterministic; no extra salt file).
- Payload JSON: `{ data: T, exp?: number }` where `exp` is Unix seconds when `maxAge` is set.
- Encrypt: AES-GCM, random 12-byte IV; ciphertext includes auth tag.
- Cookie value: `base64url(iv) + '.' + base64url(ciphertextWithTag)`.
- Unseal failure (bad base64, decrypt error, missing cookie, `exp` in the past) → `session.data = null`; do not throw.

No npm crypto dependency.

## App API

```ts
createHandler({
  routes,
  appHtml,
  session: { secret: process.env.SESSION_SECRET! },
})
```

```ts
import { requireSession } from '@avedon/server'

route('/admin', {
  component: Admin,
  guard: requireSession({ redirectTo: '/login' }),
})
```

`requireSession(opts?)`:

Deny helper: `opts.redirectTo` ? `redirect(opts.redirectTo)` : `false` (existing 403 path).

- **Client `GuardEvent`** (no `cookies` property — runtime client nav/CSR boot): **allow**. Session cookies are httpOnly; the client cannot verify them. Document loads and mutations are enforced on the server; client guard is best-effort only for non-session checks.
- **Server event, session not configured** (`cookies` present, `session` undefined): **deny** (fail closed on misconfiguration).
- **Server event, `session.data == null`**: **deny**.
- **Server event, `session.data` set**: **allow**.

App-owned login/logout (illustrative; not framework exports):

```ts
actions: {
  login: async (event) => {
    event.session!.set({ userId: '1' })
    return redirect('/')
  },
  logout: async (event) => {
    event.session!.destroy()
    return redirect('/')
  },
}
```

## Response cookie merge

All pipeline return paths that produce a `Response` must run through a single attach step so `cookies.set` / `session.set` / `session.destroy` are not dropped. Prefer wrapping at the end of `handleRequest` / `dispatchMatched` (and error render paths) via `attachCookies(response, cookies)` rather than duplicating header logic.

## Docs / example

- New `docs/session.md`; link from `docs/README.md`, routing, and guide.
- Example app: replace or supplement fake `?auth=1` guard with a session-based demo when practical.
- `create-avedon-app`: no required scaffold in v1; document `SESSION_SECRET` in README / session docs.

## Testing

- Unit: cookie parse / serialize / delete; seal round-trip; expired → null; tampered → null; short secret → throw at createHandler.
- Pipeline: `event.cookies.get` sees request cookie; `session.set` yields `Set-Cookie` on response; `requireSession` allow / 403 / redirect.
- CSRF unchanged (Origin/Referer); no interaction beyond SameSite defaults.

## Compatibility

- Apps without `session` config: `event.cookies` available; `event.session` absent; existing guards unchanged.
- No change to middleware `locals` non-goal.
