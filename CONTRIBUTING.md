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

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).

## Need help?

See [SUPPORT.md](./SUPPORT.md).
