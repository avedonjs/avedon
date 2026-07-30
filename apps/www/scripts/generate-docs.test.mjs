import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  flattenSlugs,
  generateDocs,
  HOME_COUNTER_SPECIMEN,
  loadManifest,
  syncAppHtmlOrigin,
} from './generate-docs.mjs'
import { getDocsOrigin, DEFAULT_DOCS_ORIGIN } from './site-origin.mjs'
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
    publicDir: null,
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

  const specimen = JSON.parse(
    fs.readFileSync(path.join(outDir, 'home-specimen.json'), 'utf8'),
  )
  assert.match(specimen.html, /class="shiki/)
  assert.match(specimen.html, /language-avedon/)
  assert.match(specimen.html, /@avedon\/runtime/)
  assert.ok(HOME_COUNTER_SPECIMEN.includes('signal(0)'))

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

test('highlightAve matches script end tags with whitespace before >', async () => {
  const highlighter = await getHighlighter()
  const src = `<script>
  const n = 1
</script >
`
  const html = highlightAve(highlighter, src)
  assert.match(html, /language-avedon/)
  assert.match(html, /const/)
})

test('highlightCode maps avedon alias and typescript', async () => {
  const highlighter = await getHighlighter()
  const ts = highlightCode(highlighter, 'const x: number = 1', 'ts')
  assert.match(ts, /class="shiki/)
  assert.match(ts, /github-dark-high-contrast/)
  const ave = highlightCode(highlighter, '<script>\nconst n = 1\n</script>', 'avedon')
  assert.match(ave, /language-avedon/)
})

test('getDocsOrigin defaults and strips trailing slash', () => {
  assert.equal(getDocsOrigin({}), DEFAULT_DOCS_ORIGIN)
  assert.equal(getDocsOrigin({ AVEDON_DOCS_ORIGIN: 'https://avedon.dev/' }), 'https://avedon.dev')
})

test('syncAppHtmlOrigin rewrites og/twitter image and og:url to absolute origin', () => {
  const tmp = path.join(outDir, 'app.html')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    tmp,
    `<meta property="og:image" content="/og-image.png" />
<meta name="twitter:image" content="https://old.example/og-image.png" />
<meta property="og:url" content="https://old.example/" />
`,
    'utf8',
  )
  syncAppHtmlOrigin(tmp, 'https://avedon.dev')
  const html = fs.readFileSync(tmp, 'utf8')
  assert.match(html, /property="og:image" content="https:\/\/avedon\.dev\/og-image\.png"/)
  assert.match(html, /name="twitter:image" content="https:\/\/avedon\.dev\/og-image\.png"/)
  assert.match(html, /property="og:url" content="https:\/\/avedon\.dev\/"/)
})

test('generateDocs writes sitemap for a custom origin', async () => {
  const pub = path.join(outDir, 'public-origin')
  fs.rmSync(pub, { recursive: true, force: true })
  fs.mkdirSync(pub, { recursive: true })
  await generateDocs({
    docsDir,
    outPath: path.join(outDir, 'docs-origin.json'),
    publicDir: pub,
    origin: 'https://avedon.dev',
  })
  const robots = fs.readFileSync(path.join(pub, 'robots.txt'), 'utf8')
  const sitemap = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8')
  assert.match(robots, /Sitemap: https:\/\/avedon\.dev\/sitemap\.xml/)
  assert.match(sitemap, /<loc>https:\/\/avedon\.dev\/<\/loc>/)
})
