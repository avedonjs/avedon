# Avedon VS Code / Cursor extension

Diagnostics for `.ave` files via `@avedon/language-server`.

## Local install (dev)

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
cursor --install-extension packages/vscode-avedon/avedon-vscode-0.1.0.vsix
# or
code --install-extension packages/vscode-avedon/avedon-vscode-0.1.0.vsix
```

## What v1 does

- Language id `avedon` for `*.ave`
- File / tab icons via language `icon` (Avedon monogram, light + dark)
- Minimal TextMate grammar (script/style/template + `{#…}` / `{@…}`)
- Squiggle diagnostics from the Avedon compiler (`diagnoseAve`)

Explorer icons appear when the active **File Icon Theme** supports language icons (e.g. Seti, Minimal).

## Not in v1

Completion, hover, go-to-definition, rename, embedded TypeScript language service.
Sibling `*.ave.d.ts` files (from the Vite plugin) remain the typing story.
