# Session and cookies

avedon provides cookie helpers on every server `LoadEvent` and optional **sealed session cookies** (Web Crypto AES-GCM).

## Enable session

In `src/server-entry.ts` (or wherever you export the server app), configure session and ensure the adapter/dev server reads it:

```ts
export const session = {
  secret: process.env.SESSION_SECRET!, // at least 32 characters
}
```

Pass `session` into `createHandler` when you wire the server yourself. The Node adapter and Vite dev server read `serverApp.session` from `server-entry.ts` when exported.

Set `SESSION_SECRET` in your environment before running production — see [Configuration](./configuration.md).

## Cookies

Every `load`, `actions`, `api_*`, and `guard` handler receives `event.cookies`:

```ts
export async function load({ cookies }) {
  const theme = cookies.get('theme')
  return { theme }
}
```

`cookies.set(name, value, opts?)` and `cookies.delete(name)` queue `Set-Cookie` on the response.

## Session

When session is configured, `event.session` is available:

```ts
export const actions = {
  login: async ({ session, formData }) => {
    session!.set({ userId: String(formData.get('user')) })
    return redirect('/')
  },
  logout: async ({ session }) => {
    session!.destroy()
    return redirect('/')
  },
}
```

`session.data` is `null` when the cookie is missing, expired, or tampered.

## Guards

```ts
import { requireSession } from '@avedon/server'

route('/admin', {
  component: Admin,
  guard: requireSession({ redirectTo: '/login' }),
})
```

Without `redirectTo`, failed checks return **403**.

On the **client**, guards run without `cookies` / `session`; `requireSession` allows navigation (httpOnly cookies are not readable in JS). Enforcement happens on the server for document loads and form actions.

## Security defaults

Session cookies default to `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` on HTTPS. Form `actions` still use [CSRF](./middleware.md) Origin/Referer checks.

## Limits

- Sealed cookie payload must stay under **4096** bytes
- No server-side session store in v1 (no Redis/DB session ids)
- Login and user verification are app code — the framework only seals the payload you store

## See also

- [Routing — Guards](./routing.md)
- [Security](./security.md)
- [Configuration](./configuration.md)
