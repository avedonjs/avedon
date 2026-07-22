# avedon www

Public landing + docs (dogfood). Content source: repo `docs/*.md` via `pnpm generate`.

**Live:** [https://avedon.pages.dev](https://avedon.pages.dev)

## Develop

```bash
pnpm install
pnpm build
pnpm -F www dev
```

## Build

```bash
pnpm -F www build
```

Output: `apps/www/build/client` (static SSG HTML + assets).

## Deploy (Cloudflare Pages)

Project name: `avedon` → production URL `https://avedon.pages.dev`

### Local / direct upload

```bash
pnpm build
pnpm -F www build
pnpm -F www pages:deploy
```

Requires `wrangler login` (already used for the first deploy).

### CI (GitHub Actions)

Workflow: `.github/workflows/pages.yml` (on push to `main` when www/docs/packages change).

Repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | Token with **Account → Cloudflare Pages → Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | `e3714019f2a0917f5191a9ea42b65b1b` |

Create token: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → “Edit Cloudflare Workers” template is enough (includes Pages), or custom with Pages Edit.

Dashboard: [Pages → avedon](https://dash.cloudflare.com/e3714019f2a0917f5191a9ea42b65b1b/pages/view/avedon)

No Node server at runtime — all v1 routes are SSG.
