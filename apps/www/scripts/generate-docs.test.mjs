import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { flattenSlugs, generateDocs, loadManifest } from './generate-docs.mjs'
import { getHighlighter, highlightAve, highlightCode } from './highlight.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../.generated-test')
const docsDir = path.resolve(__dirname, '../../../docs')

test('generateDocs writes quick-start and manifest groups', async () => {
  fs.rmSync(outDir, { recursive: true, force: true })
  const manifest = loadManifest(path.join(docsDir, 'manifest.json'))
  const expectedSlugs = flattenSlugs(manifest)

  const file = await generateDocs({
    docsDir,
    outPath: path.join(outDir, 'docs.json'),
  })
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))

  assert.ok(Array.isArray(data.groups))
  assert.equal(data.groups.length, manifest.groups.length)
  assert.equal(data.docs.length, expectedSlugs.length)

  const quickStart = data.docs.find((d) => d.slug === 'quick-start')
  assert.ok(quickStart)
  assert.match(quickStart.title, /Quick start/i)
  assert.match(quickStart.html, /<h1/i)
  assert.match(quickStart.html, /class="shiki/)
  assert.ok(!data.docs.some((d) => d.slug === 'guide'))

  // Keep apps/www/src/lib/doc-paths.ts DOC_SLUGS in sync with manifest.
  const docPaths = fs.readFileSync(
    path.join(__dirname, '../src/lib/doc-paths.ts'),
    'utf8',
  )
  for (const slug of expectedSlugs) {
    assert.match(docPaths, new RegExp(`'${slug}'`))
  }
})

test('highlightAve colors script body as TypeScript and template as Svelte', async () => {
  const highlighter = await getHighlighter()
  const src = `<script server>
  export async function load() {
    return { data: { ok: true } }
  }
</script>

<template>
  {#if data.ok}
    <h1>Hi</h1>
  {/if}
</template>
`
  const html = highlightAve(highlighter, src)
  assert.match(html, /<pre class="shiki/)
  assert.match(html, /language-avedon/)
  // TS keyword / function coloring from script body
  assert.match(html, /style="[^"]*color:[^"]+"/)
  assert.match(html, /export|async|function|load/)
})

test('highlightCode maps avedon alias and typescript', async () => {
  const highlighter = await getHighlighter()
  const ts = highlightCode(highlighter, 'const x: number = 1', 'ts')
  assert.match(ts, /class="shiki/)
  const ave = highlightCode(highlighter, '<script>\nconst n = 1\n</script>', 'avedon')
  assert.match(ave, /language-avedon/)
})
