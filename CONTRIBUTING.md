# Contributing to avedon

Thanks for contributing. By participating, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Setup

```bash
pnpm install
pnpm build
```

## Verify changes

```bash
pnpm test
pnpm test:smoke
```

If you touch end-to-end behavior, also run:

```bash
pnpm test:e2e
```

## Local development

```bash
pnpm -F example dev
```

Open http://localhost:5173.

## Pull requests

1. Target the `main` branch.
2. Keep changes focused; describe **why** in the PR summary.
3. Prefer tests for behavior changes (`pnpm test` / smoke / e2e as appropriate).
4. Fill out the PR template checklist.

### Changesets (versioned packages)

User-facing changes to publishable packages under `packages/*` should include a changeset so releases stay consistent:

```bash
pnpm changeset
```

Follow the prompts (semver bump + summary). Commit the generated file under `.changeset/` with your PR. The release workflow opens or updates a **Version Packages** PR on `main`; merging that PR triggers npm publish.

Publishable packages include `avedon`, `create-avedon-app`, and all `@avedon/*` workspace packages. The root workspace and `examples/*` apps are private and are not published.

### CI status checks

GitHub Actions runs on every push and pull request. Before merging to `main`, enable branch protection (Settings → Branches → `main`) and require these checks to pass:

| Check | Workflow |
|-------|----------|
| Install | CI |
| Typecheck | CI |
| Build | CI |
| Test | CI |
| Smoke tests | E2E / Smoke |
| Analyze (javascript-typescript) | CodeQL |

## Release & npm

See **[docs/publishing.md](./docs/publishing.md)** for the first manual publish and Trusted Publisher setup.

Summary:

1. **First publish** — maintainers run `pnpm build && pnpm changeset publish` locally with OTP (GAT bypass2fa / long-lived publish tokens are deprecated).
2. **Ongoing** — configure npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC) per package → workflow `release.yml`, repo `avedonjs/avedon`. The Release workflow uses Node 22 + `id-token: write`.
3. **Optional `NPM_TOKEN`** — fallback only until OIDC is verified; then remove it.
4. If the org blocks Actions from opening PRs, open the `changeset-release/main` Version Packages PR manually with `gh` (see publishing docs).

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).

## Need help?

See [SUPPORT.md](./SUPPORT.md).
