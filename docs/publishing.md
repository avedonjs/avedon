# Publishing

## Registry status

Packages are on npm (`avedon`, `create-avedon-app`, `@avedon/*`). Ongoing releases use Changesets + `.github/workflows/release.yml` with **npm Trusted Publisher (OIDC)** — no long-lived `NPM_TOKEN` in GitHub Actions.

Publishable packages (lockstep — always the same version):

- `avedon`
- `create-avedon-app`
- `@avedon/compiler`, `@avedon/runtime`, `@avedon/server`, `@avedon/shared`, `@avedon/vite-plugin`
- `@avedon/language-server`
- `@avedon/adapter-node`, `@avedon/adapter-bun`, `@avedon/adapter-cloudflare`, `@avedon/adapter-static`

Configured via Changesets [`fixed`](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md) in `.changeset/config.json`. Any changeset bumps **all** of them to the same next version, even if a package had no code changes. Private `avedon-vscode` is kept on the same version by `scripts/sync-private-package-versions.mjs` (run from `pnpm changeset:version`).

Verify:

```bash
npm view avedon version
npm view @avedon/compiler version
npm view create-avedon-app version
```

## Trusted Publisher (OIDC)

Long-lived publish tokens / GAT `bypass2fa` are deprecated ([npm changelog 2026-07-08](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)). This repo publishes with [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

`release.yml` has:

- `permissions.id-token: write`
- Node 22 + npm 11 (≥11.5.1)
- **no** `NPM_TOKEN` / `NODE_AUTH_TOKEN` (if set, `changesets/action` writes an auth `.npmrc` and OIDC is skipped)
- no `setup-node` `registry-url` (that also injects an auth `.npmrc`)

On publish, the action logs `No NPM_TOKEN found, but OIDC is available - using npm trusted publishing`. Provenance attestations are generated automatically for public packages from this public repo.

**New packages:** before the first OIDC publish of `@avedon/adapter-static`, configure a Trusted Publisher for that package (same `REPO` / `FILE` as above).

### Configure / verify trusted publishers

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
  @avedon/language-server \
  @avedon/adapter-node \
  @avedon/adapter-bun \
  @avedon/adapter-cloudflare \
  @avedon/adapter-static
do
  npm trust github "$pkg" --repo "$REPO" --file "$FILE" --allow-publish -y
done

# Spot-check
npm trust list avedon
npm trust list @avedon/compiler
```

Website alternative: each package on npmjs.com → **Access** → **Trusted Publisher** → GitHub Actions:

| Field | Value |
|-------|--------|
| Organization or user | `avedonjs` |
| Repository | `avedon` |
| Workflow filename | `release.yml` (filename only) |
| Environment name | _(leave blank)_ |
| Allowed actions | `npm publish` |

### Hardening (optional)

After OIDC publish is proven:

1. Package **Publishing access** → require 2FA and **disallow tokens**.
2. Keep GitHub Actions free of any npm write token secrets.

## Manual publish (emergency)

```bash
git checkout main && git pull
pnpm install
pnpm build
# pnpm 9 delegates publish to npm and passes --git-checks; npm 12 rejects that flag.
# Use npm 11 for the publish CLI. Do not enable provenance locally — OIDC only.
npm install -g npm@11
NPM_CONFIG_PROVENANCE=false pnpm changeset publish
```

When prompted, enter your npm OTP. If the CLI accepts a flag:

```bash
pnpm changeset publish --otp=XXXXXX
```

### Version Packages PR (org may block Actions PRs)

If GitHub Actions cannot create PRs, the Release job may push `changeset-release/main` and fail on PR creation. Typical causes:

1. Org setting: **Actions → General → Workflow permissions** keeps the default token **read-only** (repo cannot elevate to write — `409 Write permissions for workflows are disabled by the organization`).
2. Checkbox **Allow GitHub Actions to create and approve pull requests** is off.

Until an org admin enables write (or the PR checkbox), open the PR yourself:

```bash
gh pr create -R avedonjs/avedon --base main --head changeset-release/main \
  --title "chore: version packages" --body "Changesets version bump"
```

Merge when required checks are green. The next Release run publishes via OIDC.
