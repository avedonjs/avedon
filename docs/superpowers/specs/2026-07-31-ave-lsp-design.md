# Avedon `.ave` LSP (diagnostics v1)

Updated: 2026-07-31
**Status:** Implemented
**Plan:** `docs/superpowers/plans/2026-07-31-ave-lsp.md`

## Goal

Ship a diagnostics-first language service for `.ave` files so editors show compile/parse squiggles with line/column, plus a VS Code/Cursor extension that speaks LSP.

## Non-goals (v1)

- Completion, hover, go-to-definition, rename
- Embedded TypeScript language service inside `<script>`
- Source maps for emitted JS
- Marketplace publish (local VSIX / workspace install only)

## Locked decisions

| Topic | Choice |
|-------|--------|
| v1 features | Diagnostics only |
| Distribution | `@avedon/language-server` + `avedon-vscode` extension |
| Offset model | Absolute UTF-16 offsets into the full `.ave` file |
| Compile API | `compile` still throws; `diagnoseAve` never throws |
| Script typing | Sibling `*.ave.d.ts` remains the typing story |

## Architecture

```
Editor → avedon-vscode → @avedon/language-server → diagnoseAve() → @avedon/compiler
                                                              ↓
                                              publishDiagnostics (LSP)
```

## Compiler API

- `SourceRange { start, end }` — UTF-16 offsets
- `CompileDiagnostic { message, range, severity: 'error' }`
- `CompileError` — thrown from template compile with diagnostics
- `diagnoseAve(source, options?)` — returns `CompileDiagnostic[]`
- `parse()` exposes `ranges` for section bodies (client/server/style/markup)

## Packages

- [`packages/language-server`](../../packages/language-server) — `avedon-language-server` stdio server
- [`packages/vscode-avedon`](../../packages/vscode-avedon) — language id `avedon`, TextMate grammar, language client

## Install (editor)

See [`packages/vscode-avedon/README.md`](../../packages/vscode-avedon/README.md).
