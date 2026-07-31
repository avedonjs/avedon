import { describe, expect, it } from 'vitest'
import { diagnoseAve, parse } from './index.js'

describe('diagnoseAve', () => {
  it('returns no diagnostics for valid source', () => {
    const source = `
<script lang="ts">
  export let title
</script>
<template>
  <h1>{title}</h1>
</template>
`
    expect(diagnoseAve(source)).toEqual([])
  })

  it('reports unclosed expression with absolute offsets', () => {
    const source = `<template>\n  <p>{title</p>\n</template>\n`
    const diags = diagnoseAve(source)
    expect(diags.length).toBeGreaterThanOrEqual(1)
    const d = diags[0]!
    expect(d.message).toMatch(/Unclosed expression/)
    expect(d.severity).toBe('error')
    expect(source.slice(d.range.start, d.range.start + 1)).toBe('{')
  })

  it('reports invalid each', () => {
    const source = `<template>{#each items}x{/each}</template>`
    const diags = diagnoseAve(source)
    expect(diags.some((d) => /Invalid each/.test(d.message))).toBe(true)
    const d = diags.find((d) => /Invalid each/.test(d.message))!
    expect(source.slice(d.range.start, d.range.start + 1)).toBe('{')
  })

  it('reports unknown snippet render', () => {
    const source = `<template>{@render missing}</template>`
    const diags = diagnoseAve(source)
    expect(diags.some((d) => /Unknown snippet/.test(d.message))).toBe(true)
  })

  it('reports UI component + server script', () => {
    const source = `
<script server>
  export function load() { return {} }
</script>
<template><p>x</p></template>
`
    const diags = diagnoseAve(source, { asUiComponent: true, filename: 'Btn.ave' })
    expect(diags.some((d) => /UI components cannot have a <script server>/.test(d.message))).toBe(
      true,
    )
    const d = diags.find((d) => /UI components/.test(d.message))!
    expect(source.slice(d.range.start, d.range.end)).toContain('export function load')
  })

  it('parse ranges point at markup body', () => {
    const source = `<script>let x = 1</script>\n<template>\n  <b>hi</b>\n</template>\n`
    const p = parse(source)
    expect(source.slice(p.ranges.markup.start, p.ranges.markup.end)).toBe('<b>hi</b>')
  })
})
