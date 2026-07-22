import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DocEntry, DocsFile } from './doc-types'

export type { DocEntry, DocHeading, DocsFile } from './doc-types'

const generated = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.generated/docs.json',
)

export function loadDocsFile(): DocsFile {
  if (!fs.existsSync(generated)) {
    throw new Error('Missing .generated/docs.json — run pnpm -F www generate')
  }
  return JSON.parse(fs.readFileSync(generated, 'utf8')) as DocsFile
}

export function listDocs(): DocEntry[] {
  return loadDocsFile().docs
}

export function getDoc(slug: string): DocEntry | undefined {
  return listDocs().find((d) => d.slug === slug)
}
