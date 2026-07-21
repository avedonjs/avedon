export interface ParsedAvedon {
  clientScript: string
  serverScript: string
  style: string
  markup: string
  scriptLang: string
  serverLang: string
  scoped: boolean
}

interface TagBlock {
  attrs: string
  body: string
  start: number
  end: number
}

/** Linear scan for `<tag ...>body</tag>` (optional space before `>` in the closer). */
function findTagBlock(source: string, tag: string, from: number): TagBlock | null {
  const open = `<${tag}`
  const close = `</${tag}`
  const lower = source.toLowerCase()
  let i = from
  while (i < source.length) {
    const idx = lower.indexOf(open, i)
    if (idx === -1) return null
    const afterName = idx + open.length
    const boundary = source[afterName]
    if (boundary !== undefined && boundary !== '>' && !isAsciiSpace(boundary)) {
      i = afterName
      continue
    }
    let gt = afterName
    while (gt < source.length && source[gt] !== '>') gt++
    if (gt >= source.length) return null
    const attrs = source.slice(afterName, gt)
    const bodyStart = gt + 1
    let k = bodyStart
    while (k < source.length) {
      const cidx = lower.indexOf(close, k)
      if (cidx === -1) return null
      let m = cidx + close.length
      while (m < source.length && isAsciiSpace(source[m]!)) m++
      if (source[m] === '>') {
        return {
          attrs,
          body: source.slice(bodyStart, cidx),
          start: idx,
          end: m + 1,
        }
      }
      k = cidx + 1
    }
    return null
  }
  return null
}

function isAsciiSpace(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 12
}

function extractAll(source: string, tag: string): { blocks: TagBlock[]; remaining: string } {
  const blocks: TagBlock[] = []
  let remaining = ''
  let i = 0
  while (i < source.length) {
    const block = findTagBlock(source, tag, i)
    if (!block) {
      remaining += source.slice(i)
      break
    }
    remaining += source.slice(i, block.start)
    blocks.push(block)
    i = block.end
  }
  return { blocks, remaining }
}

export function parse(source: string): ParsedAvedon {
  let clientScript = ''
  let serverScript = ''
  let scriptLang = 'ts'
  let serverLang = 'ts'
  let style = ''
  let scoped = true

  const scripts = extractAll(source, 'script')
  for (const block of scripts.blocks) {
    const attrStr = block.attrs
    const langMatch = attrStr.match(/lang\s*=\s*["']([^"']+)["']/)
    const lang = langMatch?.[1] ?? 'ts'
    const isServer = /\bserver\b/.test(attrStr)
    if (isServer) {
      serverScript += block.body
      serverLang = lang
    } else {
      clientScript += block.body
      scriptLang = lang
    }
  }

  const styles = extractAll(scripts.remaining, 'style')
  for (const block of styles.blocks) {
    const attrStr = block.attrs
    if (/\bunscoped\b/.test(attrStr)) scoped = false
    if (/\bscoped\b/.test(attrStr)) scoped = true
    style += block.body
  }

  let remaining = styles.remaining
  const template = findTagBlock(remaining, 'template', 0)
  const markup = template ? template.body.trim() : remaining.trim()

  return {
    clientScript: clientScript.trim(),
    serverScript: serverScript.trim(),
    style: style.trim(),
    markup,
    scriptLang,
    serverLang,
    scoped,
  }
}

export type AvedonBlockKind = 'server' | 'client' | 'style' | 'template'

/** Which `.ave` blocks differ between two source versions. */
export function changedBlocks(prev: string, next: string): Set<AvedonBlockKind> {
  const a = parse(prev)
  const b = parse(next)
  const out = new Set<AvedonBlockKind>()
  if (a.serverScript !== b.serverScript) out.add('server')
  if (a.clientScript !== b.clientScript) out.add('client')
  if (a.style !== b.style) out.add('style')
  if (a.markup !== b.markup) out.add('template')
  return out
}

export function hashStyle(css: string, filename: string): string {
  let h = 2166136261
  const input = filename + '\0' + css
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 'avedon-' + (h >>> 0).toString(36)
}

/** Unwrap `:global(...)` without regex backtracking. */
function unwrapGlobal(css: string): string {
  const token = ':global('
  let out = ''
  let i = 0
  while (i < css.length) {
    const idx = css.indexOf(token, i)
    if (idx === -1) {
      out += css.slice(i)
      break
    }
    out += css.slice(i, idx)
    let depth = 1
    let j = idx + token.length
    while (j < css.length && depth > 0) {
      const ch = css[j]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      j++
    }
    out += css.slice(idx + token.length, depth === 0 ? j - 1 : j)
    i = j
  }
  return out
}

export function scopeCss(css: string, hash: string): string {
  if (!css.trim()) return ''
  const unwrapped = unwrapGlobal(css)
  return unwrapped.replace(/(^|})\s*([^@{}][^{]*)\{/g, (_m, brace: string, selector: string) => {
    const scoped = selector
      .split(',')
      .map((s) => {
        const t = s.trim()
        if (!t) return t
        if (t.includes(hash)) return t
        // don't scope bare html/body
        if (t === 'html' || t === 'body' || t.startsWith('body ') || t.startsWith('html ')) return t
        return `${t}[${hash}]`
      })
      .join(', ')
    return `${brace} ${scoped} {`
  })
}
