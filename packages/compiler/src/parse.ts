export interface ParsedAvedon {
  clientScript: string
  serverScript: string
  style: string
  markup: string
  scriptLang: string
  serverLang: string
  scoped: boolean
}

const SCRIPT_RE =
  /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi
const STYLE_RE = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi
const TEMPLATE_RE = /<template(\s[^>]*)?>([\s\S]*?)<\/template>/i

export function parse(source: string): ParsedAvedon {
  let clientScript = ''
  let serverScript = ''
  let scriptLang = 'ts'
  let serverLang = 'ts'
  let style = ''
  let scoped = true
  let remaining = source

  remaining = remaining.replace(SCRIPT_RE, (_full, attrs = '', body = '') => {
    const attrStr = String(attrs)
    const langMatch = attrStr.match(/lang\s*=\s*["']([^"']+)["']/)
    const lang = langMatch?.[1] ?? 'ts'
    const isServer = /\bserver\b/.test(attrStr)
    if (isServer) {
      serverScript += body
      serverLang = lang
    } else {
      clientScript += body
      scriptLang = lang
    }
    return ''
  })

  remaining = remaining.replace(STYLE_RE, (_full, attrs = '', body = '') => {
    const attrStr = String(attrs)
    if (/\bunscoped\b/.test(attrStr)) scoped = false
    if (/\bscoped\b/.test(attrStr)) scoped = true
    style += body
    return ''
  })

  const templateMatch = remaining.match(TEMPLATE_RE)
  let markup: string
  if (templateMatch) {
    markup = templateMatch[2].trim()
  } else {
    markup = remaining.trim()
  }

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

export function scopeCss(css: string, hash: string): string {
  if (!css.trim()) return ''
  // unwrap :global(...) to unscoped selectors
  const unwrapped = css.replace(/:global\(([^)]+)\)/g, '$1')
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
