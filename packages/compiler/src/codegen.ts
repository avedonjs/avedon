/** Compile vex markup into SSR expression (returns HTML string) and client DOM builder. */

function escapeForTemplateLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

export interface CompiledTemplate {
  ssrExpr: string
  /** statements that build `el` HTMLElement from state */
  clientBuild: string
}

export function compileMarkup(markup: string, hash: string): CompiledTemplate {
  const tokens = tokenize(markup)
  return {
    ssrExpr: emitSsr(tokens, hash),
    clientBuild: emitClient(tokens, hash),
  }
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'expr'; value: string }
  | { type: 'slot' }
  | { type: 'if'; cond: string; then: Token[]; else?: Token[] }
  | { type: 'each'; list: string; item: string; index?: string; body: Token[] }
  | { type: 'await'; promise: string; thenName: string; thenBody: Token[]; catchName?: string; catchBody?: Token[] }
  | {
      type: 'element'
      tag: string
      attrs: Attr[]
      children: Token[]
      selfClosing: boolean
    }

interface Attr {
  name: string
  value: string | null
  kind: 'static' | 'event' | 'bind' | 'expr'
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  function peek() {
    return input[i]
  }
  function startsWith(s: string) {
    return input.slice(i, i + s.length) === s
  }

  while (i < input.length) {
    if (startsWith('{#if ')) {
      i += 5
      const condEnd = input.indexOf('}', i)
      const cond = input.slice(i, condEnd).trim()
      i = condEnd + 1
      const { body, rest } = readBlock(input.slice(i), ['{:else}', '{/if}'])
      i += body.consumed
      let elseBody: Token[] | undefined
      if (rest === '{:else}') {
        const elseBlock = readBlock(input.slice(i), ['{/if}'])
        elseBody = tokenize(elseBlock.body.raw)
        i += elseBlock.body.consumed
      }
      tokens.push({ type: 'if', cond, then: tokenize(body.raw), else: elseBody })
      continue
    }

    if (startsWith('{#each ')) {
      i += 7
      const end = input.indexOf('}', i)
      const header = input.slice(i, end).trim()
      i = end + 1
      const m = header.match(/^(.+?)\s+as\s+(\w+)(?:\s*,\s*(\w+))?$/)
      if (!m) throw new Error(`Invalid each: ${header}`)
      const block = readBlock(input.slice(i), ['{/each}'])
      i += block.body.consumed
      tokens.push({
        type: 'each',
        list: m[1].trim(),
        item: m[2],
        index: m[3],
        body: tokenize(block.body.raw),
      })
      continue
    }

    if (startsWith('{#await ')) {
      i += 8
      const end = input.indexOf('}', i)
      const promise = input.slice(i, end).trim()
      i = end + 1
      const thenBlock = readBlock(input.slice(i), ['{:then', '{:catch', '{/await}'])
      i += thenBlock.body.consumed
      let thenName = 'value'
      let thenBody: Token[] = []
      let catchName: string | undefined
      let catchBody: Token[] | undefined
      if (thenBlock.rest?.startsWith('{:then')) {
        const nameMatch = thenBlock.rest.match(/^\{\:then\s+(\w+)\}/)
        thenName = nameMatch?.[1] ?? 'value'
        const tb = readBlock(input.slice(i), ['{:catch', '{/await}'])
        thenBody = tokenize(tb.body.raw)
        i += tb.body.consumed
        if (tb.rest?.startsWith('{:catch')) {
          const cm = tb.rest.match(/^\{\:catch\s+(\w+)\}/)
          catchName = cm?.[1] ?? 'error'
          const cb = readBlock(input.slice(i), ['{/await}'])
          catchBody = tokenize(cb.body.raw)
          i += cb.body.consumed
        }
      } else {
        thenBody = tokenize(thenBlock.body.raw)
      }
      tokens.push({ type: 'await', promise, thenName, thenBody, catchName, catchBody })
      continue
    }

    if (startsWith('{') && !startsWith('{#') && !startsWith('{/') && !startsWith('{:')) {
      const end = input.indexOf('}', i + 1)
      if (end === -1) throw new Error('Unclosed expression')
      tokens.push({ type: 'expr', value: input.slice(i + 1, end).trim() })
      i = end + 1
      continue
    }

    if (peek() === '<') {
      const parsed = parseStartTag(input, i)
      if (!parsed) {
        tokens.push({ type: 'text', value: '<' })
        i++
        continue
      }
      if (parsed.closing) {
        tokens.push({ type: 'text', value: parsed.raw })
        i += parsed.raw.length
        continue
      }
      i += parsed.raw.length
      if (parsed.tag.toLowerCase() === 'slot') {
        if (!parsed.selfClosing) {
          const closeIdx = findClosingTag(input, i, parsed.tag)
          if (closeIdx === -1) throw new Error('Unclosed tag <slot>')
          i = closeIdx + `</${parsed.tag}>`.length
        }
        tokens.push({ type: 'slot' })
        continue
      }
      const attrs = parseAttrs(parsed.attrStr)
      const selfClosing = parsed.selfClosing || VOID.has(parsed.tag.toLowerCase())
      let children: Token[] = []
      if (!selfClosing) {
        const close = `</${parsed.tag}>`
        const closeIdx = findClosingTag(input, i, parsed.tag)
        if (closeIdx === -1) throw new Error(`Unclosed tag <${parsed.tag}>`)
        children = tokenize(input.slice(i, closeIdx))
        i = closeIdx + close.length
      }
      tokens.push({ type: 'element', tag: parsed.tag, attrs, children, selfClosing })
      continue
    }

    // text until next special
    let j = i + 1
    while (j < input.length && input[j] !== '<' && input[j] !== '{') j++
    tokens.push({ type: 'text', value: input.slice(i, j) })
    i = j
  }

  return tokens
}

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** Parse `<tag attrs>` / `</tag>` / `<tag />` without breaking on `>` inside `{...}` or quotes. */
function parseStartTag(
  input: string,
  from: number,
): { raw: string; tag: string; attrStr: string; selfClosing: boolean; closing: boolean } | null {
  if (input[from] !== '<') return null
  let j = from + 1
  const closing = input[j] === '/'
  if (closing) j++
  const tagStart = j
  if (!/[a-zA-Z]/.test(input[j] ?? '')) return null
  j++
  while (j < input.length && /[\w-]/.test(input[j])) j++
  const tag = input.slice(tagStart, j)
  const attrStart = j
  let quote: '"' | "'" | null = null
  let braceDepth = 0
  while (j < input.length) {
    const c = input[j]
    if (quote) {
      if (c === quote) quote = null
      j++
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      j++
      continue
    }
    if (c === '{') {
      braceDepth++
      j++
      continue
    }
    if (c === '}' && braceDepth > 0) {
      braceDepth--
      j++
      continue
    }
    if (c === '>' && braceDepth === 0) {
      const before = input.slice(attrStart, j).trimEnd()
      const selfClosing = !closing && before.endsWith('/')
      const attrStr = selfClosing ? before.slice(0, -1) : input.slice(attrStart, j)
      return {
        raw: input.slice(from, j + 1),
        tag,
        attrStr,
        selfClosing,
        closing,
      }
    }
    j++
  }
  return null
}

function findClosingTag(input: string, from: number, tag: string): number {
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')
  const close = new RegExp(`</${tag}>`, 'gi')
  let depth = 1
  let idx = from
  while (depth > 0 && idx < input.length) {
    open.lastIndex = idx
    close.lastIndex = idx
    const o = open.exec(input)
    const c = close.exec(input)
    if (!c) return -1
    if (o && o.index < c.index) {
      if (!o[0].endsWith('/>') && !VOID.has(tag.toLowerCase())) depth++
      idx = o.index + o[0].length
    } else {
      depth--
      if (depth === 0) return c.index
      idx = c.index + c[0].length
    }
  }
  return -1
}

function readBlock(
  input: string,
  terminators: string[],
): { body: { raw: string; consumed: number }; rest?: string } {
  let depthIf = 0
  let depthEach = 0
  let depthAwait = 0
  let i = 0
  while (i < input.length) {
    if (input.startsWith('{#if ', i)) {
      depthIf++
      i += 5
      continue
    }
    if (input.startsWith('{#each ', i)) {
      depthEach++
      i += 7
      continue
    }
    if (input.startsWith('{#await ', i)) {
      depthAwait++
      i += 8
      continue
    }
    if (input.startsWith('{/if}', i)) {
      if (depthIf === 0 && terminators.includes('{/if}')) {
        return { body: { raw: input.slice(0, i), consumed: i + 5 }, rest: '{/if}' }
      }
      depthIf--
      i += 5
      continue
    }
    if (input.startsWith('{/each}', i)) {
      if (depthEach === 0 && terminators.includes('{/each}')) {
        return { body: { raw: input.slice(0, i), consumed: i + 7 }, rest: '{/each}' }
      }
      depthEach--
      i += 7
      continue
    }
    if (input.startsWith('{/await}', i)) {
      if (depthAwait === 0 && terminators.includes('{/await}')) {
        return { body: { raw: input.slice(0, i), consumed: i + 8 }, rest: '{/await}' }
      }
      depthAwait--
      i += 8
      continue
    }
    if (
      depthIf === 0 &&
      depthEach === 0 &&
      depthAwait === 0 &&
      terminators.some((t) => input.startsWith(t, i))
    ) {
      const term = terminators.find((t) => input.startsWith(t, i))!
      // for {:else} / {:then x} / {:catch x} include the tag in rest
      if (term.startsWith('{:')) {
        const end = input.indexOf('}', i)
        const full = input.slice(i, end + 1)
        return { body: { raw: input.slice(0, i), consumed: end + 1 }, rest: full }
      }
      return { body: { raw: input.slice(0, i), consumed: i + term.length }, rest: term }
    }
    i++
  }
  throw new Error(`Unclosed block, expected ${terminators.join(' | ')}`)
}

function parseAttrs(attrStr: string): Attr[] {
  const attrs: Attr[] = []
  let i = 0
  const s = attrStr

  function skipWs() {
    while (i < s.length && /\s/.test(s[i])) i++
  }

  function readBalanced(open: string, close: string): string {
    // s[i] is open; return inner content, advance past matching close
    let depth = 0
    const start = i + 1
    for (; i < s.length; i++) {
      const c = s[i]
      if (c === open) depth++
      else if (c === close) {
        depth--
        if (depth === 0) {
          const inner = s.slice(start, i)
          i++
          return inner
        }
      }
    }
    throw new Error(`Unclosed ${open}...${close} in attribute`)
  }

  while (i < s.length) {
    skipWs()
    if (i >= s.length) break
    const nameStart = i
    while (i < s.length && /[^\s=]/.test(s[i])) i++
    const name = s.slice(nameStart, i)
    if (!name) break
    skipWs()
    if (s[i] !== '=') {
      attrs.push({ name, value: null, kind: 'static' })
      continue
    }
    i++ // =
    skipWs()
    let value = ''
    let kind: Attr['kind'] = 'static'
    if (s[i] === '"') {
      i++
      const end = s.indexOf('"', i)
      value = s.slice(i, end === -1 ? s.length : end)
      i = end === -1 ? s.length : end + 1
    } else if (s[i] === "'") {
      i++
      const end = s.indexOf("'", i)
      value = s.slice(i, end === -1 ? s.length : end)
      i = end === -1 ? s.length : end + 1
    } else if (s[i] === '{') {
      value = readBalanced('{', '}').trim()
      kind = 'expr'
    } else {
      const start = i
      while (i < s.length && /[^\s"'{>]/.test(s[i])) i++
      value = s.slice(start, i)
    }
    if (name.startsWith('on:')) {
      attrs.push({ name, value, kind: 'event' })
    } else if (name.startsWith('bind:')) {
      attrs.push({ name, value, kind: 'bind' })
    } else if (kind === 'expr') {
      attrs.push({ name, value, kind: 'expr' })
    } else {
      attrs.push({ name, value, kind: 'static' })
    }
  }
  return attrs
}

function emitSsr(tokens: Token[], hash: string): string {
  const parts: string[] = []
  for (const t of tokens) {
    if (t.type === 'text') {
      parts.push('`' + escapeForTemplateLiteral(t.value) + '`')
    } else if (t.type === 'slot') {
      parts.push(`(__props.children ?? '')`)
    } else if (t.type === 'expr') {
      parts.push(`__escape(${t.value})`)
    } else if (t.type === 'if') {
      const thenExpr = emitSsr(t.then, hash)
      const elseExpr = t.else ? emitSsr(t.else, hash) : '``'
      parts.push(`((${t.cond}) ? (${thenExpr}) : (${elseExpr}))`)
    } else if (t.type === 'each') {
      const body = emitSsr(t.body, hash)
      const idx = t.index ? `, ${t.index}` : ''
      parts.push(`((${t.list}) || []).map((${t.item}${idx}) => (${body})).join('')`)
    } else if (t.type === 'await') {
      // SSR: empty placeholder; resolved on client
      parts.push('``')
    } else if (t.type === 'element') {
      parts.push(emitSsrElement(t, hash))
    }
  }
  return parts.length ? parts.join(' + ') : '``'
}

function emitSsrElement(el: Token & { type: 'element' }, hash: string): string {
  const attrParts: string[] = [`\` ${hash}\``]
  for (const a of el.attrs) {
    if (a.kind === 'event') continue
    if (a.kind === 'bind' && a.name === 'bind:value') {
      attrParts.push(`\` value="\` + __escape(${a.value}) + \`"\``)
      continue
    }
    if (a.kind === 'expr') {
      attrParts.push(`\` ${a.name}="\` + __escape(${a.value}) + \`"\``)
    } else if (a.value == null) {
      attrParts.push(`\` ${a.name}\``)
    } else {
      attrParts.push('`' + escapeForTemplateLiteral(` ${a.name}="${a.value}"`) + '`')
    }
  }
  const closeOpen = el.selfClosing || VOID.has(el.tag.toLowerCase()) ? ' />`' : '>`'
  const open =
    '`' +
    escapeForTemplateLiteral(`<${el.tag}`) +
    '` + ' +
    attrParts.join(' + ') +
    ' + `' +
    closeOpen
  if (el.selfClosing || VOID.has(el.tag.toLowerCase())) {
    return `(${open})`
  }
  const children = emitSsr(el.children, hash)
  return `(${open}) + (${children}) + (` + '`' + escapeForTemplateLiteral(`</${el.tag}>`) + '`)'
}

function emitClient(tokens: Token[], hash: string): string {
  return `const __root = document.createDocumentFragment();\n${emitClientNodes(tokens, hash, '__root')}\ntarget.appendChild(__root);\n`
}

function emitClientNodes(tokens: Token[], hash: string, parent: string): string {
  const lines: string[] = []
  let n = 0
  for (const t of tokens) {
    const id = `${parent}_n${n++}`
    if (t.type === 'text') {
      lines.push(`{ const ${id} = document.createTextNode(${JSON.stringify(t.value)}); ${parent}.appendChild(${id}); }`)
    } else if (t.type === 'slot') {
      lines.push(`{
        const ${id} = document.createElement('div');
        ${id}.innerHTML = String(__props.children ?? '');
        while (${id}.firstChild) ${parent}.appendChild(${id}.firstChild);
      }`)
    } else if (t.type === 'expr') {
      lines.push(`{
        const ${id} = document.createTextNode('');
        ${parent}.appendChild(${id});
        __effects.push(() => { ${id}.data = String(${t.value} ?? ''); });
      }`)
    } else if (t.type === 'if') {
      lines.push(`{
        const ${id} = document.createComment('if');
        ${parent}.appendChild(${id});
        let __anchor = ${id};
        let __nodes = [];
        __effects.push(() => {
          for (const n of __nodes) n.remove();
          __nodes = [];
          const __frag = document.createDocumentFragment();
          if (${t.cond}) {
            ${emitClientNodes(t.then, hash, '__frag')}
          } ${t.else ? `else { ${emitClientNodes(t.else, hash, '__frag')} }` : ''}
          while (__frag.firstChild) { __nodes.push(__frag.firstChild); __anchor.parentNode.insertBefore(__frag.firstChild, __anchor.nextSibling); }
        });
      }`)
    } else if (t.type === 'each') {
      const idx = t.index ?? '__i'
      lines.push(`{
        const ${id} = document.createComment('each');
        ${parent}.appendChild(${id});
        let __nodes = [];
        __effects.push(() => {
          for (const n of __nodes) n.remove();
          __nodes = [];
          const __frag = document.createDocumentFragment();
          ((${t.list}) || []).forEach((${t.item}, ${idx}) => {
            ${emitClientNodes(t.body, hash, '__frag')}
          });
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, ${id}.nextSibling);
          }
        });
      }`)
    } else if (t.type === 'await') {
      lines.push(`{
        const ${id} = document.createComment('await');
        ${parent}.appendChild(${id});
        let __nodes = [];
        Promise.resolve(${t.promise}).then((${t.thenName}) => {
          for (const n of __nodes) n.remove();
          __nodes = [];
          const __frag = document.createDocumentFragment();
          ${emitClientNodes(t.thenBody, hash, '__frag')}
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, ${id}.nextSibling);
          }
        }${t.catchBody ? `, (${t.catchName ?? 'error'}) => {
          for (const n of __nodes) n.remove();
          __nodes = [];
          const __frag = document.createDocumentFragment();
          ${emitClientNodes(t.catchBody!, hash, '__frag')}
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, ${id}.nextSibling);
          }
        }` : ''});
      }`)
    } else if (t.type === 'element') {
      lines.push(emitClientElement(t, hash, parent, id))
    }
  }
  return lines.join('\n')
}

function emitClientElement(
  el: Token & { type: 'element' },
  hash: string,
  parent: string,
  id: string,
): string {
  const lines = [
    `const ${id} = document.createElement(${JSON.stringify(el.tag)});`,
    `${id}.setAttribute(${JSON.stringify(hash)}, '');`,
  ]
  for (const a of el.attrs) {
    if (a.kind === 'event') {
      const ev = a.name.slice(3)
      lines.push(
        `${id}.addEventListener(${JSON.stringify(ev)}, function(event){ const __handler = (${a.value}); if (typeof __handler === 'function') __handler.call(this, event); __invalidate(); });`,
      )
    } else if (a.kind === 'bind' && a.name === 'bind:value') {
      lines.push(`__effects.push(() => { ${id}.value = ${a.value} ?? ''; });`)
      lines.push(`${id}.addEventListener('input', () => { ${a.value} = ${id}.value; __invalidate(); });`)
    } else if (a.kind === 'expr') {
      lines.push(`__effects.push(() => { ${id}.setAttribute(${JSON.stringify(a.name)}, String(${a.value} ?? '')); });`)
    } else if (a.value == null) {
      lines.push(`${id}.setAttribute(${JSON.stringify(a.name)}, '');`)
    } else {
      lines.push(`${id}.setAttribute(${JSON.stringify(a.name)}, ${JSON.stringify(a.value)});`)
    }
  }
  if (!el.selfClosing && !VOID.has(el.tag.toLowerCase())) {
    lines.push(emitClientNodes(el.children, hash, id))
  }
  lines.push(`${parent}.appendChild(${id});`)
  return `{ ${lines.join('\n')} }`
}
