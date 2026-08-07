import { readFileSync } from 'node:fs'
import { parse } from '@avedon/compiler'
import type { CompletionItem, Hover, Location, Position, Range } from 'vscode-languageserver/node.js'
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver/node.js'
import type { TextDocument } from 'vscode-languageserver-textdocument'

const TEMPLATE_SNIPPETS: Array<{ label: string; detail: string; insertText: string }> = [
  { label: '{#if}', detail: 'Conditional block', insertText: '{#if ${1:cond}}\n\t$0\n{/if}' },
  { label: '{#each}', detail: 'List block', insertText: '{#each ${1:items} as ${2:item}}\n\t$0\n{/each}' },
  { label: '{#await}', detail: 'Promise block', insertText: '{#await ${1:promise}}\n\t$2\n{:then ${3:value}}\n\t$0\n{/await}' },
  { label: '{#key}', detail: 'Remount block', insertText: '{#key ${1:expr}}\n\t$0\n{/key}' },
  { label: '{#snippet}', detail: 'Local snippet', insertText: '{#snippet ${1:name}(${2:args})}\n\t$0\n{/snippet}' },
  { label: '{@html}', detail: 'Trusted HTML', insertText: '{@html ${1:html}}' },
  { label: '{@const}', detail: 'Template local', insertText: '{@const ${1:name} = ${2:expr}}' },
  { label: '{@render}', detail: 'Render snippet', insertText: '{@render ${1:name}(${2:args})}' },
  { label: 'transition:fade', detail: 'Fade transition', insertText: 'transition:fade' },
  { label: 'transition:crossfade', detail: 'Crossfade transition', insertText: 'transition:crossfade={{ key: ${1:id} }}' },
  { label: 'bind:value', detail: 'Two-way value bind', insertText: 'bind:value={${1:signal}}' },
  { label: 'on:click', detail: 'Click handler', insertText: 'on:click={${1:handler}}' },
  { label: 'class:', detail: 'Class directive', insertText: 'class:${1:name}={${2:expr}}' },
  { label: 'style:', detail: 'Style directive', insertText: 'style:${1:prop}={${2:expr}}' },
  { label: 'use:', detail: 'Element action', insertText: 'use:${1:action}' },
]

const RUNTIME_COMPLETIONS: Array<{ label: string; detail: string }> = [
  { label: 'signal', detail: '@avedon/runtime writable signal' },
  { label: 'computed', detail: '@avedon/runtime derived signal' },
  { label: 'effect', detail: '@avedon/runtime reactive effect' },
  { label: 'batch', detail: '@avedon/runtime batched writes' },
  { label: 'onMount', detail: '@avedon/runtime mount lifecycle' },
  { label: 'onDestroy', detail: '@avedon/runtime destroy lifecycle' },
  { label: 'tick', detail: '@avedon/runtime flush microtask' },
  { label: 'untrack', detail: '@avedon/runtime sample without deps' },
  { label: 'setContext', detail: '@avedon/runtime context API' },
  { label: 'getContext', detail: '@avedon/runtime context API' },
]

const BLOCK_HELP: Record<string, string> = {
  if: 'Conditional block — `{#if cond}…{:else}…{/if}`',
  each: 'List block — `{#each items as item}…{/each}`',
  await: 'Promise block — `{#await p}…{:then v}…{/await}`',
  key: 'Remount when expression identity changes — `{#key expr}…{/key}`',
  snippet: 'Local snippet — `{#snippet name(args)}…{/snippet}`',
  html: 'Insert trusted HTML (see docs/security.md) — `{@html …}`',
  const: 'Sibling-scoped template local — `{@const name = expr}`',
  render: 'Invoke a `{#snippet}` — `{@render name(…)}`',
}

export type ScriptSymbol = {
  name: string
  kind: 'prop' | 'binding' | 'function'
  detail: string
  /** UTF-16 offset of the symbol name in the full `.ave` source */
  nameStart: number
  nameEnd: number
}

/** Parse `import Name from './File.ave'` (and similar) from client script. */
export function extractComponentImportMap(clientScript: string): Map<string, string> {
  const map = new Map<string, string>()
  const re =
    /\bimport\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"]([^'"]+\.ave)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clientScript))) {
    map.set(m[1]!, m[2]!)
  }
  return map
}

/**
 * Lightweight client-script symbol index (not a full TS language service).
 * Locates `export let`, `const/let/var` bindings, and `function` declarations.
 */
export function extractScriptSymbols(source: string): ScriptSymbol[] {
  let clientScript = ''
  let scriptStart = 0
  try {
    const parsed = parse(source)
    clientScript = parsed.clientScript
    scriptStart = parsed.ranges.clientScript?.start ?? 0
  } catch {
    return []
  }
  if (!clientScript) return []

  const out: ScriptSymbol[] = []
  const seen = new Set<string>()

  const push = (name: string, kind: ScriptSymbol['kind'], detail: string, localIndex: number) => {
    if (!name || seen.has(name)) return
    seen.add(name)
    const nameStart = scriptStart + localIndex
    out.push({
      name,
      kind,
      detail,
      nameStart,
      nameEnd: nameStart + name.length,
    })
  }

  for (const m of clientScript.matchAll(/\bexport\s+let\s+([A-Za-z_$][\w$]*)/g)) {
    push(m[1]!, 'prop', 'Component prop (`export let`)', m.index! + m[0]!.lastIndexOf(m[1]!))
  }
  for (const m of clientScript.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
  )) {
    push(m[1]!, 'binding', 'Local binding', m.index! + m[0]!.indexOf(m[1]!))
  }
  for (const m of clientScript.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    push(m[1]!, 'function', 'Function declaration', m.index! + m[0]!.indexOf(m[1]!))
  }

  return out
}

function offsetInMarkup(source: string, offset: number): boolean {
  try {
    const parsed = parse(source)
    const r = parsed.ranges.markup
    if (!r) return false
    return offset >= r.start && offset <= r.end
  } catch {
    return /<template[\s>]/.test(source.slice(0, offset)) && !/<\/template>/.test(source.slice(0, offset).split('<template').pop() ?? '')
  }
}

function offsetInClientScript(source: string, offset: number): boolean {
  try {
    const parsed = parse(source)
    const r = parsed.ranges.clientScript
    if (!r) return false
    return offset >= r.start && offset <= r.end
  } catch {
    return false
  }
}

function wordAt(doc: TextDocument, position: Position): { text: string; start: number; end: number } {
  const offset = doc.offsetAt(position)
  const text = doc.getText()
  let start = offset
  let end = offset
  while (start > 0 && /[A-Za-z0-9_:-]/.test(text[start - 1]!)) start--
  while (end < text.length && /[A-Za-z0-9_:-]/.test(text[end]!)) end++
  return { text: text.slice(start, end), start, end }
}

function resolveImportUri(docUri: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null
  try {
    const base = docUri.replace(/\/[^/]*$/, '/')
    const parts = base.replace(/^file:\/\//, '').split('/').filter((p) => p.length > 0)
    for (const seg of importPath.split('/')) {
      if (seg === '.' || seg === '') continue
      if (seg === '..') parts.pop()
      else parts.push(seg)
    }
    return 'file:///' + parts.join('/')
  } catch {
    return null
  }
}

function rangeAtOffsets(doc: TextDocument, start: number, end: number): Range {
  return {
    start: doc.positionAt(Math.max(0, start)),
    end: doc.positionAt(Math.max(0, end)),
  }
}

/** Prefer pointing at `<template>` / `<script>` when the target file is readable. */
export function definitionRangeForAveSource(source: string): Range {
  const template = source.search(/<template[\s>]/)
  if (template >= 0) {
    const end = Math.min(source.length, template + '<template'.length)
    // Approximate line/char without a TextDocument: compute manually
    let line = 0
    let character = 0
    for (let i = 0; i < template; i++) {
      if (source[i] === '\n') {
        line++
        character = 0
      } else {
        character++
      }
    }
    let endLine = line
    let endCharacter = character
    for (let i = template; i < end; i++) {
      if (source[i] === '\n') {
        endLine++
        endCharacter = 0
      } else {
        endCharacter++
      }
    }
    return {
      start: { line, character },
      end: { line: endLine, character: endCharacter },
    }
  }
  const script = source.search(/<script[\s>]/)
  if (script >= 0) {
    let line = 0
    let character = 0
    for (let i = 0; i < script; i++) {
      if (source[i] === '\n') {
        line++
        character = 0
      } else {
        character++
      }
    }
    return {
      start: { line, character },
      end: { line, character: character + Math.min(7, source.length - script) },
    }
  }
  return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
}

function findImportNameRange(
  source: string,
  componentName: string,
): { start: number; end: number } | null {
  const re = new RegExp(
    `\\bimport\\s+(${componentName})\\s+from\\s+['"][^'"]+\\.ave['"]`,
  )
  const m = re.exec(source)
  if (!m || m.index == null) return null
  const start = m.index + m[0]!.indexOf(componentName)
  return { start, end: start + componentName.length }
}

export function getCompletions(doc: TextDocument, position: Position): CompletionItem[] {
  const offset = doc.offsetAt(position)
  const source = doc.getText()
  const items: CompletionItem[] = []

  if (offsetInMarkup(source, offset)) {
    for (const s of TEMPLATE_SNIPPETS) {
      items.push({
        label: s.label,
        kind: CompletionItemKind.Snippet,
        detail: s.detail,
        insertText: s.insertText,
        insertTextFormat: 2, // Snippet
      })
    }
  }

  if (offsetInClientScript(source, offset) || offsetInMarkup(source, offset)) {
    for (const r of RUNTIME_COMPLETIONS) {
      items.push({
        label: r.label,
        kind: CompletionItemKind.Function,
        detail: r.detail,
      })
    }
    for (const sym of extractScriptSymbols(source)) {
      items.push({
        label: sym.name,
        kind:
          sym.kind === 'function'
            ? CompletionItemKind.Function
            : sym.kind === 'prop'
              ? CompletionItemKind.Property
              : CompletionItemKind.Variable,
        detail: sym.detail,
      })
    }
  }

  try {
    const parsed = parse(source)
    for (const name of extractComponentImportMap(parsed.clientScript).keys()) {
      items.push({
        label: name,
        kind: CompletionItemKind.Class,
        detail: 'Imported .ave component',
      })
    }
  } catch {
    /* ignore parse errors for completion */
  }

  return items
}

export function getHover(doc: TextDocument, position: Position): Hover | null {
  const { text } = wordAt(doc, position)
  if (!text) return null
  const source = doc.getText()

  try {
    const parsed = parse(source)
    const imports = extractComponentImportMap(parsed.clientScript)
    if (imports.has(text)) {
      const path = imports.get(text)!
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${text}** — Avedon component\n\n\`import ${text} from '${path}'\``,
        },
      }
    }
  } catch {
    /* ignore */
  }

  const sym = extractScriptSymbols(source).find((s) => s.name === text)
  if (sym) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${sym.name}** — ${sym.detail}`,
      },
    }
  }

  const blockKey = text.replace(/^\{[#@]?/, '').replace(/\}$/, '')
  if (BLOCK_HELP[blockKey] || BLOCK_HELP[text]) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: BLOCK_HELP[blockKey] ?? BLOCK_HELP[text]!,
      },
    }
  }
  for (const [k, v] of Object.entries(BLOCK_HELP)) {
    if (text === `{#${k}}` || text === `{@${k}}` || text === k) {
      return { contents: { kind: MarkupKind.Markdown, value: v } }
    }
  }

  const runtime = RUNTIME_COMPLETIONS.find((r) => r.label === text)
  if (runtime) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${runtime.label}** — ${runtime.detail}`,
      },
    }
  }

  return null
}

export function getDefinition(doc: TextDocument, position: Position): Location | null {
  const { text } = wordAt(doc, position)
  if (!text) return null
  const source = doc.getText()

  // Local script symbol → definition inside this file
  const sym = extractScriptSymbols(source).find((s) => s.name === text)
  if (sym && offsetInClientScript(source, doc.offsetAt(position))) {
    return {
      uri: doc.uri,
      range: rangeAtOffsets(doc, sym.nameStart, sym.nameEnd),
    }
  }

  if (!/^[A-Z]/.test(text)) return null
  try {
    const parsed = parse(source)
    const imports = extractComponentImportMap(parsed.clientScript)
    const rel = imports.get(text)
    if (!rel) return null
    const uri = resolveImportUri(doc.uri, rel)
    if (!uri) return null

    // Prefer target file `<template>` range when readable; else import name in this file.
    try {
      const filePath = decodeURIComponent(uri.replace(/^file:\/\//, ''))
      const targetSource = readFileSync(filePath, 'utf8')
      return { uri, range: definitionRangeForAveSource(targetSource) }
    } catch {
      const local = findImportNameRange(source, text)
      if (local) {
        return {
          uri: doc.uri,
          range: rangeAtOffsets(doc, local.start, local.end),
        }
      }
      return {
        uri,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      }
    }
  } catch {
    return null
  }
}
