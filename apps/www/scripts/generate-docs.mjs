import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

export const SLUGS = [
  'guide',
  'avedon-components',
  'routing',
  'rendering',
  'middleware',
  'session',
  'security',
  'packages',
]

const SLUG_SET = new Set(SLUGS)

/**
 * @param {string} text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * @param {string} md
 * @param {Set<string>} known
 */
function rewriteMdLinks(md, known) {
  return md.replace(
    /\[([^\]]+)\]\((\.\/)?([a-z0-9-]+)\.md(#[^)]+)?\)/gi,
    (full, label, _dot, target, hash = '') => {
      const slug = target.toLowerCase()
      if (!known.has(slug)) return full
      return `[${label}](/docs/${slug}${hash || ''})`
    },
  )
}

/**
 * @param {string} md
 */
function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m)
  return m?.[1]?.trim() ?? null
}

/**
 * @param {string} md
 * @param {string} title
 */
function extractBlurb(md, title) {
  const withoutTitle = md.replace(/^#\s+.+$/m, '').trim()
  const para = withoutTitle.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#'))
  if (!para) return title
  const plain = para
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain
}

/**
 * @param {string} html
 */
function extractHeadings(html) {
  /** @type {{ id: string, text: string, level: 2 | 3 }[]} */
  const headings = []
  const re = /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi
  let m
  while ((m = re.exec(html))) {
    const level = Number(m[1])
    const attrs = m[2] ?? ''
    const inner = m[3].replace(/<[^>]+>/g, '').trim()
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i)
    const id = idMatch?.[1] ?? slugify(inner)
    headings.push({ id, text: inner, level: /** @type {2 | 3} */ (level) })
  }
  return headings
}

/**
 * Ensure h2/h3 have id attributes.
 * @param {string} html
 */
function ensureHeadingIds(html) {
  return html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (full, level, attrs = '', inner) => {
    if (/\sid=["']/i.test(attrs)) return full
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const id = slugify(text)
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
  })
}

/**
 * @param {{ docsDir: string, outPath: string }} opts
 */
export async function generateDocs({ docsDir, outPath }) {
  /** @type {{ slug: string, title: string, blurb: string, html: string, headings: { id: string, text: string, level: 2 | 3 }[] }[]} */
  const docs = []

  for (const slug of SLUGS) {
    const file = path.join(docsDir, `${slug}.md`)
    if (!fs.existsSync(file)) {
      throw new Error(`Missing docs/${slug}.md`)
    }
    const raw = fs.readFileSync(file, 'utf8')
    const title = extractTitle(raw) ?? slug
    const blurb = extractBlurb(raw, title)
    const md = rewriteMdLinks(raw, SLUG_SET)
    let html = ensureHeadingIds(await marked.parse(md))
    const headings = extractHeadings(html)
    docs.push({ slug, title, blurb, html, headings })
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({ docs }, null, 2) + '\n', 'utf8')
  return outPath
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const appRoot = path.resolve(scriptDir, '..')
  const repoRoot = path.resolve(appRoot, '../..')
  await generateDocs({
    docsDir: path.join(repoRoot, 'docs'),
    outPath: path.join(appRoot, '.generated', 'docs.json'),
  })
  console.log('Wrote', path.join(appRoot, '.generated', 'docs.json'))
}
