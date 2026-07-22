import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDocs } from './generate-docs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../.generated-test')

test('generateDocs writes guide slug with Getting started title', async () => {
  fs.rmSync(outDir, { recursive: true, force: true })
  const file = await generateDocs({
    docsDir: path.resolve(__dirname, '../../../docs'),
    outPath: path.join(outDir, 'docs.json'),
  })
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const guide = data.docs.find((d) => d.slug === 'guide')
  assert.ok(guide)
  assert.match(guide.title, /Getting started/i)
  assert.match(guide.html, /<h1/i)
  assert.equal(data.docs.length, 8)
})
