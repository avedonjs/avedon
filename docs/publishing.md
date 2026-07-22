# Publishing

## First publish (manual, one-time)

Packages are at **0.1.1** and not yet on the registry. Do this from a machine where you can complete npm 2FA / OTP:

```bash
git checkout main && git pull
pnpm install
pnpm build
pnpm changeset publish
```

When prompted, enter your npm OTP. If the CLI accepts a flag:

```bash
pnpm changeset publish --otp=XXXXXX
```

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

### After first publish — Trusted Publisher (OIDC)

Long-lived publish tokens / GAT `bypass2fa` are being deprecated ([npm changelog 2026-07-08](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)). Prefer [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

For **each** package on npmjs.com → **Settings → Trusted Publisher → GitHub Actions**:

| Field | Value |
|-------|--------|
| Organization or user | `avedonjs` |
| Repository | `avedon` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` (and optionally `npm stage publish`) |

`release.yml` already has `id-token: write`, Node 22, and latest npm for OIDC.

Optional: after OIDC works, set package **Publishing access** to “Require two-factor authentication and disallow tokens”, then delete the GitHub `NPM_TOKEN` secret.

### Version Packages PR (org may block Actions PRs)

If GitHub Actions cannot create PRs (org “Allow GitHub Actions to create and approve pull requests” locked off), the Release job may push `changeset-release/main` and fail on PR creation. Open the PR yourself:

```bash
gh pr create -R avedonjs/avedon --base main --head changeset-release/main \
  --title "chore: version packages" --body "Changesets version bump"
```

Merge when required checks are green. The next Release run publishes via OIDC.
