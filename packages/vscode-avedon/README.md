# Avedon VS Code / Cursor extension

Language support for `.ave` files via `@avedon/language-server`: diagnostics, completion, hover, go-to-definition (components + local script symbols), and a light client-script symbol index.

## Install

### From Marketplace / Open VSX (when published)

Search for **Avedon** (`avedonjs.avedon-vscode`) in the VS Code Marketplace or [Open VSX](https://open-vsx.org/). Publishing is driven by [`.github/workflows/publish-vscode.yml`](../../.github/workflows/publish-vscode.yml) when `VSCE_PAT` / `OVSX_PAT` secrets are set.

### Local VSIX (dev)

From the monorepo root:

```bash
pnpm -F @avedon/compiler build
pnpm -F @avedon/language-server build
pnpm -F avedon-vscode package
```

`package` bundles the extension + language server into `dist/` (esbuild) and runs `vsce package --no-dependencies` (pnpm workspaces break `vsce`’s `npm list`).

Then in VS Code or Cursor:

- **Extensions: Install from VSIX…** and pick `packages/vscode-avedon/avedon-vscode-*.vsix`

Or:

```bash
cursor --install-extension packages/vscode-avedon/avedon-vscode-*.vsix
# or
code --install-extension packages/vscode-avedon/avedon-vscode-*.vsix
```

CI uploads the VSIX as a workflow artifact named `avedon-vscode` on every green Build job (main/PRs).

## Features

- Language id `avedon` for `*.ave`
- File / tab icons via language `icon` (Avedon monogram, light + dark)
- Minimal TextMate grammar (script/style/template + `{#…}` / `{@…}`)
- Squiggle diagnostics from the Avedon compiler (`diagnoseAve`)
- Template / runtime completions (`{#if}`, `{@html}`, `signal`, `transition:crossfade`, …)
- Hover on imported PascalCase components, template blocks, runtime APIs, and local script symbols
- Go to definition: component tags → target `.ave` (`<template>` range when readable) or import name; script symbols → declaration site

Sibling `*.ave.d.ts` files (from the Vite plugin) remain the TypeScript typing story for `<script>` bodies. Rename / embedded TS LS are not included yet.
