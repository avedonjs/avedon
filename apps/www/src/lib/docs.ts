import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DocEntry, DocGroup, DocsFile } from './doc-types'

export type { DocEntry, DocGroup, DocHeading, DocsFile } from './doc-types'

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

export function listGroups(): DocGroup[] {
  return loadDocsFile().groups
}

export function getDoc(slug: string): DocEntry | undefined {
  return listDocs().find((d) => d.slug === slug)
}

export function getAdjacentDocs(slug: string): {
  prev: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
} {
  const docs = listDocs()
  const i = docs.findIndex((d) => d.slug === slug)
  if (i < 0) return { prev: null, next: null }
  const prev = i > 0 ? docs[i - 1]! : null
  const next = i < docs.length - 1 ? docs[i + 1]! : null
  return {
    prev: prev ? { slug: prev.slug, title: prev.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  }
}

export type NavGroup = {
  id: string
  title: string
  docs: { slug: string; title: string; blurb?: string }[]
}

export function listNavGroups(includeBlurb = false): NavGroup[] {
  const file = loadDocsFile()
  const bySlug = new Map(file.docs.map((d) => [d.slug, d]))
  return file.groups.map((g) => ({
    id: g.id,
    title: g.title,
    docs: g.slugs.map((slug) => {
      const entry = bySlug.get(slug)
      if (!entry) throw new Error(`Manifest slug missing from docs: ${slug}`)
      return includeBlurb
        ? { slug: entry.slug, title: entry.title, blurb: entry.blurb }
        : { slug: entry.slug, title: entry.title }
    }),
  }))
}
