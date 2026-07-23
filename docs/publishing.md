# Publishing

## Registry status

Packages are at **0.1.1** on npm (`avedon`, `create-avedon-app`, `@avedon/*`). First publish was manual with OTP. Ongoing releases use Changesets + `.github/workflows/release.yml`.

Publishable packages:

- `avedon`
- `create-avedon-app`
- `@avedon/compiler`, `@avedon/runtime`, `@avedon/server`, `@avedon/shared`, `@avedon/vite-plugin`
- `@avedon/adapter-node`, `@avedon/adapter-bun`, `@avedon/adapter-cloudflare`

Verify:

```bash
npm view avedon version
npm view @avedon/compiler version
npm view create-avedon-app version
```

## Trusted Publisher (OIDC) — required for Actions publish

Long-lived publish tokens / GAT `bypass2fa` are being deprecated ([npm changelog 2026-07-08](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)). Prefer [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

`release.yml` already has `id-token: write`, Node 22, and npm 11 for OIDC.

### Configure via CLI (preferred)

Requires npm ≥ 11.5.1 and an owner login (`npm login`):

```bash
npm login   # must be an owner of each package / @avedonjs org

REPO=avedonjs/avedon
FILE=release.yml

for pkg in \
  avedon \
  create-avedon-app \
  @avedon/shared \
  @avedon/compiler \
  @avedon/runtime \
  @avedon/server \
  @avedon/vite-plugin \
  @avedon/adapter-node \
  @avedon/adapter-bun \
  @avedon/adapter-cloudflare
do
  npm trust github "$pkg" --repo "$REPO" --file "$FILE" --allow-publish -y
done

# Spot-check
npm trust list avedon
npm trust list @avedon/compiler
```

### Configure via website (alternative)

For **each** package on npmjs.com → package → **Access** (not account settings) → **Trusted Publisher** → GitHub Actions:

| Field | Value |
|-------|--------|
| Organization or user | `avedonjs` |
| Repository | `avedon` |
| Workflow filename | `release.yml` (filename only, not `.github/workflows/…`) |
| Environment name | _(leave blank)_ |
| Allowed actions | `npm publish` (and optionally `npm stage publish`) |

Direct Access URLs (scoped packages use the full name in the path):

- https://www.npmjs.com/package/avedon/access
- https://www.npmjs.com/package/create-avedon-app/access
- https://www.npmjs.com/package/@avedon/compiler/access
- (same pattern for `runtime`, `server`, `shared`, `vite-plugin`, `adapter-node`, `adapter-bun`, `adapter-cloudflare`)

### After OIDC works

1. Confirm a Release run can publish without relying on a classic token (empty changeset → Version PR only is fine; a real version bump is the real proof).
2. Optional: set package **Publishing access** to require 2FA and disallow tokens.
3. Delete the GitHub Actions secret `NPM_TOKEN` (and remove `NPM_TOKEN` / `NODE_AUTH_TOKEN` from `release.yml` once confident).

Until Trusted Publisher is configured on every package, keep `NPM_TOKEN` as a fallback.

## Manual publish (emergency / first-time machine)

```bash
git checkout main && git pull
pnpm install
pnpm build
# pnpm 9 delegates publish to npm and passes --git-checks; npm 12 rejects that flag.
# Use npm 11 for the publish CLI (OIDC-capable, tolerates the forwarded flag).
# Do not enable provenance locally — it only works from GitHub Actions / GitLab OIDC.
npm install -g npm@11
NPM_CONFIG_PROVENANCE=false pnpm changeset publish
```

When prompted, enter your npm OTP. If the CLI accepts a flag:

```bash
pnpm changeset publish --otp=XXXXXX
```

### Version Packages PR (org may block Actions PRs)

If GitHub Actions cannot create PRs (org “Allow GitHub Actions to create and approve pull requests” locked off), the Release job may push `changeset-release/main` and fail on PR creation. Open the PR yourself:

```bash
gh pr create -R avedonjs/avedon --base main --head changeset-release/main \
  --title "chore: version packages" --body "Changesets version bump"
```

Merge when required checks are green. The next Release run publishes via OIDC.
