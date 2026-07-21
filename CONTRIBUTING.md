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
| Analyze (CodeQL) | CodeQL |

Optional but recommended: require CodeQL for PRs when the repository security policy allows it.

## Release & npm secrets

Publishing uses [Changesets](https://github.com/changesets/changesets) (`.github/workflows/release.yml`). Maintainers must configure:

1. **`NPM_TOKEN`** — Create an npm [granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with publish rights for the `avedon` / `@avedon` packages. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name `NPM_TOKEN`, paste the token value.
2. **Provenance** — The release workflow requests `id-token: write` so `pnpm changeset publish` can attach [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (no extra secret).

Until `NPM_TOKEN` is set, the release workflow can still open **Version Packages** pull requests when `.changeset/*.md` files exist. Without pending changesets, Changesets treats unpublished `0.1.0` packages as needing a first publish and the job fails with `ENEEDAUTH` — that is expected until you add `NPM_TOKEN` (or complete the first npm publish). Do not treat that red Release check as a product regression.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).

## Need help?

See [SUPPORT.md](./SUPPORT.md).
