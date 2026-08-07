import { describe, expect, it } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  definitionRangeForAveSource,
  diagnoseDocumentText,
  extractComponentImportMap,
  extractScriptSymbols,
  getCompletions,
  getDefinition,
  getHover,
  toLspDiagnostics,
} from './index.js'

describe('language-server diagnose', () => {
  it('maps unclosed expression to a line/character range', () => {
    const text = `<template>\n  <p>{title</p>\n</template>\n`
    const diags = diagnoseDocumentText(text, 'Bad.ave')
    expect(diags.length).toBeGreaterThanOrEqual(1)
    const doc = TextDocument.create('file:///Bad.ave', 'avedon', 1, text)
    const lsp = toLspDiagnostics(doc, diags)
    expect(lsp[0]!.message).toMatch(/Unclosed expression/)
    expect(lsp[0]!.range.start.line).toBe(1)
    expect(lsp[0]!.source).toBe('avedon')
  })

  it('returns empty for valid files', () => {
    expect(
      diagnoseDocumentText(`<template><p>ok</p></template>`, 'Ok.ave'),
    ).toEqual([])
  })
})

describe('language-server features v2/v3', () => {
  const sample = `<script>
  import Card from './Card.ave'
  import { signal } from '@avedon/runtime'
  export let title
  const n = signal(0)
  function inc() { n.set(n.get() + 1) }
</script>
<template>
  <Card />
  {#if true}ok{/if}
</template>
`

  it('extracts component imports', () => {
    const map = extractComponentImportMap(`import Card from './Card.ave'\n`)
    expect(map.get('Card')).toBe('./Card.ave')
  })

  it('indexes export let, bindings, and functions', () => {
    const syms = extractScriptSymbols(sample)
    expect(syms.map((s) => s.name).sort()).toEqual(['inc', 'n', 'title'])
    expect(syms.find((s) => s.name === 'title')?.kind).toBe('prop')
    expect(syms.find((s) => s.name === 'inc')?.kind).toBe('function')
  })

  it('offers template completions inside markup', () => {
    const doc = TextDocument.create('file:///App.ave', 'avedon', 1, sample)
    const items = getCompletions(doc, { line: 8, character: 2 })
    expect(items.some((i) => i.label === '{#if}')).toBe(true)
    expect(items.some((i) => i.label === 'Card')).toBe(true)
    expect(items.some((i) => i.label === 'transition:crossfade')).toBe(true)
  })

  it('offers local symbols in client script', () => {
    const doc = TextDocument.create('file:///App.ave', 'avedon', 1, sample)
    const items = getCompletions(doc, { line: 4, character: 2 })
    expect(items.some((i) => i.label === 'n')).toBe(true)
    expect(items.some((i) => i.label === 'inc')).toBe(true)
  })

  it('hovers imported component tags', () => {
    const doc = TextDocument.create('file:///App.ave', 'avedon', 1, sample)
    const hover = getHover(doc, { line: 8, character: 4 })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('Card'),
    })
  })

  it('hovers local script symbols', () => {
    const doc = TextDocument.create('file:///App.ave', 'avedon', 1, sample)
    const hover = getHover(doc, { line: 3, character: 14 })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('export let'),
    })
  })

  it('goes to definition for script symbols in-file', () => {
    const doc = TextDocument.create('file:///src/pages/App.ave', 'avedon', 1, sample)
    const loc = getDefinition(doc, { line: 4, character: 8 })
    expect(loc?.uri).toBe('file:///src/pages/App.ave')
    expect(loc?.range.start.line).toBe(4)
  })

  it('goes to definition for imported components (import name fallback)', () => {
    const doc = TextDocument.create('file:///src/pages/App.ave', 'avedon', 1, sample)
    const loc = getDefinition(doc, { line: 8, character: 4 })
    // Card.ave does not exist on disk → fall back to import identifier range
    expect(loc?.uri).toBe('file:///src/pages/App.ave')
    expect(loc?.range.start.line).toBe(1)
  })

  it('definitionRangeForAveSource prefers template', () => {
    const range = definitionRangeForAveSource(`<script></script>\n<template>\n  x\n</template>\n`)
    expect(range.start.line).toBe(1)
    expect(range.start.character).toBe(0)
  })
})
