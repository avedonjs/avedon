# @avedon/adapter-static

Fail-closed static export for Avedon. Writes only `build/client` (hashed assets + SSG HTML). Deploy that folder to Cloudflare Pages, Netlify, GitHub Pages, S3/CDN, etc.

## Config

```ts
import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({
    out: 'build',
    notFoundHtml: true,
    redirects: 'cloudflare',
  }),
}
```

## Requirements

Every route must use `render: 'ssg'` (with `getStaticPaths` / `entries` for param routes). The build **fails** if any route uses SSR/CSR, form `actions`, `api` / `api_*`, or `revalidate`.

Optional:

- `notFoundHtml: true | string` — write `client/404.html`
- `redirects: 'cloudflare'` — emit a stub `client/_redirects` when the app did not already provide one via `public/`

## Deploy

```bash
pnpm build
# upload ./build/client
```

Example (Cloudflare Pages):

```bash
wrangler pages deploy ./build/client --project-name=my-app
```
