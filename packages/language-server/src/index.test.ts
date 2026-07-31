import { describe, expect, it } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { diagnoseDocumentText, toLspDiagnostics } from './index.js'

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
