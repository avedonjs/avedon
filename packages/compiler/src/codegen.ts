/** Compile avedon markup into SSR expression (returns HTML string) and client DOM builder. */

function escapeForTemplateLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/** JSON string literal safe inside JS that may be embedded in HTML `<script>`. */
function jsLiteral(value: string): string {
  return JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, (ch) => {
    switch (ch) {
      case '<':
        return '\\u003c'
      case '>':
        return '\\u003e'
      case '/':
        return '\\u002f'
      case '\u2028':
        return '\\u2028'
      case '\u2029':
        return '\\u2029'
      default:
        return ch
    }
  })
}

export interface CompiledTemplate {
  ssrExpr: string
  /** statements that call __enqueue / __awaitBoundary / __pipeChildren */
  ssrStream: string
  /** statements that build `el` HTMLElement from state */
  clientBuild: string
  /** PascalCase component bindings referenced by the template */
  componentsUsed: string[]
}

export function compileMarkup(
  markup: string,
  hash: string,
  components: Set<string> = new Set(),
): CompiledTemplate {
  const tokens = tokenize(markup)
  validateTokens(tokens, components)
  return {
    ssrExpr: emitSsr(tokens, hash),
    ssrStream: emitSsrStream(tokens, hash),
    clientBuild: emitClient(tokens, hash),
    componentsUsed: [...collectComponentNames(tokens)],
  }
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'expr'; value: string }
  | { type: 'html'; value: string }
  | { type: 'const'; name: string; value: string }
  | { type: 'slot'; name?: string; fallback: Token[] }
  | { type: 'if'; cond: string; then: Token[]; else?: Token[] }
  | {
      type: 'each'
      list: string
      item: string
      index?: string
      key?: string
      body: Token[]
      else?: Token[]
    }
  | { type: 'key'; expr: string; body: Token[] }
  | { type: 'await'; promise: string; pending?: Token[]; thenName: string; thenBody: Token[]; catchName?: string; catchBody?: Token[] }
  | {
      type: 'element'
      tag: string
      attrs: Attr[]
      children: Token[]
      selfClosing: boolean
    }
  | {
      type: 'component'
      name: string
      attrs: Attr[]
      children: Token[]
      selfClosing: boolean
    }

interface Attr {
  name: string
  value: string | null
  kind: 'static' | 'event' | 'bind' | 'expr' | 'class' | 'style' | 'use' | 'transition' | 'spread'
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
      const parsed = parseIfChain(cond, input, i)
      i = parsed.next
      tokens.push(parsed.token)
      continue
    }

    if (startsWith('{#each ')) {
      i += 7
      const end = input.indexOf('}', i)
      const header = input.slice(i, end).trim()
      i = end + 1
      const m = header.match(
        /^(.+?)\s+as\s+(\w+)(?:\s*,\s*(\w+))?(?:\s+\((.+)\))?$/,
      )
      if (!m) throw new Error(`Invalid each: ${header}`)
      const block = readBlock(input.slice(i), ['{:else}', '{/each}'])
      i += block.body.consumed
      let elseBody: Token[] | undefined
      if (block.rest === '{:else}') {
        const elseBlock = readBlock(input.slice(i), ['{/each}'])
        i += elseBlock.body.consumed
        elseBody = tokenize(elseBlock.body.raw)
      } else if (block.rest !== '{/each}') {
        throw new Error(`Unexpected each terminator: ${block.rest}`)
      }
      tokens.push({
        type: 'each',
        list: m[1].trim(),
        item: m[2],
        index: m[3],
        key: m[4]?.trim(),
        body: tokenize(block.body.raw),
        else: elseBody,
      })
      continue
    }

    if (startsWith('{#key ')) {
      i += 6
      const end = input.indexOf('}', i)
      if (end === -1) throw new Error('Unclosed {#key}')
      const expr = input.slice(i, end).trim()
      if (!expr) throw new Error('{#key} requires an expression')
      i = end + 1
      const block = readBlock(input.slice(i), ['{/key}'])
      i += block.body.consumed
      tokens.push({ type: 'key', expr, body: tokenize(block.body.raw) })
      continue
    }

    if (startsWith('{#await ')) {
      i += 8
      const end = input.indexOf('}', i)
      const header = input.slice(i, end).trim()
      i = end + 1
      let promise = header
      let pending: Token[] | undefined
      let thenName = 'value'
      let thenBody: Token[] = []
      let catchName: string | undefined
      let catchBody: Token[] | undefined
      let shorthand: 'then' | 'catch' | null = null

      const thenShort = header.match(/^([\s\S]+?)\s+then\s+(\w+)$/)
      const catchShort = header.match(/^([\s\S]+?)\s+catch\s+(\w+)$/)
      if (thenShort) {
        promise = thenShort[1]!.trim()
        thenName = thenShort[2]!
        shorthand = 'then'
      } else if (catchShort) {
        promise = catchShort[1]!.trim()
        catchName = catchShort[2]!
        shorthand = 'catch'
      }
      if (!promise) throw new Error('{#await} requires a promise expression')

      if (shorthand === 'then') {
        const block = readBlock(input.slice(i), ['{:catch', '{/await}'])
        i += block.body.consumed
        thenBody = tokenize(block.body.raw)
        if (block.rest?.startsWith('{:catch')) {
          const cm = block.rest.match(/^\{\:catch(?:\s+(\w+))?\}/)
          catchName = cm?.[1] ?? 'error'
          const cb = readBlock(input.slice(i), ['{/await}'])
          catchBody = tokenize(cb.body.raw)
          i += cb.body.consumed
        }
      } else if (shorthand === 'catch') {
        const block = readBlock(input.slice(i), ['{/await}'])
        i += block.body.consumed
        catchBody = tokenize(block.body.raw)
      } else {
        const firstBlock = readBlock(input.slice(i), ['{:then', '{:catch', '{/await}'])
        i += firstBlock.body.consumed
        if (firstBlock.rest?.startsWith('{:then')) {
          pending = tokenize(firstBlock.body.raw)
          const nameMatch = firstBlock.rest.match(/^\{\:then(?:\s+(\w+))?\}/)
          thenName = nameMatch?.[1] ?? 'value'
          const tb = readBlock(input.slice(i), ['{:catch', '{/await}'])
          thenBody = tokenize(tb.body.raw)
          i += tb.body.consumed
          if (tb.rest?.startsWith('{:catch')) {
            const cm = tb.rest.match(/^\{\:catch(?:\s+(\w+))?\}/)
            catchName = cm?.[1] ?? 'error'
            const cb = readBlock(input.slice(i), ['{/await}'])
            catchBody = tokenize(cb.body.raw)
            i += cb.body.consumed
          }
        } else if (firstBlock.rest?.startsWith('{:catch')) {
          pending = tokenize(firstBlock.body.raw)
          const cm = firstBlock.rest.match(/^\{\:catch(?:\s+(\w+))?\}/)
          catchName = cm?.[1] ?? 'error'
          const cb = readBlock(input.slice(i), ['{/await}'])
          catchBody = tokenize(cb.body.raw)
          i += cb.body.consumed
        } else {
          thenBody = tokenize(firstBlock.body.raw)
        }
      }
      tokens.push({ type: 'await', promise, pending, thenName, thenBody, catchName, catchBody })
      continue
    }

    if (startsWith('{@html ')) {
      i += '{@html '.length
      const end = input.indexOf('}', i)
      if (end === -1) throw new Error('Unclosed {@html}')
      tokens.push({ type: 'html', value: input.slice(i, end).trim() })
      i = end + 1
      continue
    }

    if (startsWith('{@const ')) {
      i += '{@const '.length
      const end = input.indexOf('}', i)
      if (end === -1) throw new Error('Unclosed {@const}')
      const body = input.slice(i, end).trim()
      const m = body.match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/)
      if (!m) throw new Error(`Invalid {@const} — expected \`{@const name = expr}\`, got {@const ${body}}`)
      tokens.push({ type: 'const', name: m[1]!, value: m[2]!.trim() })
      i = end + 1
      continue
    }

    if (startsWith('{@')) {
      const m = input.slice(i).match(/^\{@(\w+)/)
      throw new Error(`Unsupported {@${m ? m[1] : ''}} — not available in v1`)
    }

    if (startsWith('{#key')) {
      throw new Error('{#key} requires an expression — use {#key expr}…{/key}')
    }

    if (startsWith('{') && !startsWith('{#') && !startsWith('{/') && !startsWith('{:')) {
      const end = input.indexOf('}', i + 1)
      if (end === -1) throw new Error('Unclosed expression')
      tokens.push({ type: 'expr', value: input.slice(i + 1, end).trim() })
      i = end + 1
      continue
    }

    if (peek() === '<') {
      if (startsWith('<!--')) {
        const end = input.indexOf('-->', i + 4)
        if (end === -1) throw new Error('Unclosed HTML comment')
        i = end + 3
        continue
      }
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
        const slotAttrs = parseAttrs(parsed.attrStr)
        let slotName: string | undefined
        for (const a of slotAttrs) {
          if (a.name === 'name') {
            if (a.kind !== 'static' || a.value == null || a.value === '') {
              throw new Error('slot name= must be a static non-empty string')
            }
            slotName = a.value
          } else {
            throw new Error(`Unsupported attribute "${a.name}" on <slot>`)
          }
        }
        let fallback: Token[] = []
        if (!parsed.selfClosing) {
          const closeIdx = findClosingTag(input, i, parsed.tag)
          if (closeIdx === -1) throw new Error('Unclosed tag <slot>')
          fallback = tokenize(input.slice(i, closeIdx))
          i = closeIdx + `</${parsed.tag}>`.length
        }
        tokens.push({ type: 'slot', name: slotName, fallback })
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
      if (/^[A-Z]/.test(parsed.tag)) {
        tokens.push({
          type: 'component',
          name: parsed.tag,
          attrs,
          children,
          selfClosing: parsed.selfClosing,
        })
        continue
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

function collectComponentNames(tokens: Token[], out: Set<string> = new Set()): Set<string> {
  for (const t of tokens) {
    if (t.type === 'component') {
      out.add(t.name)
      collectComponentNames(t.children, out)
    } else if (t.type === 'element') {
      collectComponentNames(t.children, out)
    } else if (t.type === 'slot') {
      collectComponentNames(t.fallback, out)
    } else if (t.type === 'if') {
      collectComponentNames(t.then, out)
      if (t.else) collectComponentNames(t.else, out)
    } else if (t.type === 'each') {
      collectComponentNames(t.body, out)
      if (t.else) collectComponentNames(t.else, out)
    } else if (t.type === 'key') {
      collectComponentNames(t.body, out)
    } else if (t.type === 'await') {
      if (t.pending) collectComponentNames(t.pending, out)
      collectComponentNames(t.thenBody, out)
      if (t.catchBody) collectComponentNames(t.catchBody, out)
    }
  }
  return out
}

function validateTokens(tokens: Token[], components: Set<string>): void {
  for (const t of tokens) {
    if (t.type === 'component') {
      if (!components.has(t.name)) {
        throw new Error(
          `Unknown component <${t.name}>: add \`import ${t.name} from './${t.name}.ave'\` (default import required).`,
        )
      }
      validateAttrs(t.attrs, { component: true, tag: t.name })
      validateTokens(t.children, components)
    } else if (t.type === 'element') {
      validateAttrs(t.attrs, { component: false, tag: t.tag })
      validateTokens(t.children, components)
    } else if (t.type === 'slot') {
      validateTokens(t.fallback, components)
    } else if (t.type === 'if') {
      validateTokens(t.then, components)
      if (t.else) validateTokens(t.else, components)
    } else if (t.type === 'each') {
      validateTokens(t.body, components)
      if (t.else) validateTokens(t.else, components)
    } else if (t.type === 'key') {
      validateTokens(t.body, components)
    } else if (t.type === 'await') {
      if (t.pending) validateTokens(t.pending, components)
      validateTokens(t.thenBody, components)
      if (t.catchBody) validateTokens(t.catchBody, components)
    }
  }
}

function validateAttrs(attrs: Attr[], ctx: { component: boolean; tag: string }): void {
  for (const a of attrs) {
    if (a.kind === 'spread') {
      continue
    }
    if (a.name.startsWith('{')) {
      throw new Error(`Spread attributes are not supported (${a.name}) on <${ctx.tag}>`)
    }
    const colon = a.name.indexOf(':')
    if (colon > 0) {
      const prefix = a.name.slice(0, colon)
      if (prefix === 'on') continue
      if (prefix === 'bind') {
        if (ctx.component) {
          throw new Error(`bind: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        if (
          a.name !== 'bind:value' &&
          a.name !== 'bind:checked' &&
          a.name !== 'bind:this' &&
          a.name !== 'bind:group' &&
          a.name !== 'bind:files' &&
          a.name !== 'bind:clientWidth' &&
          a.name !== 'bind:clientHeight' &&
          a.name !== 'bind:offsetWidth' &&
          a.name !== 'bind:offsetHeight' &&
          a.name !== 'bind:scrollTop' &&
          a.name !== 'bind:scrollLeft' &&
          a.name !== 'bind:selectionStart' &&
          a.name !== 'bind:selectionEnd' &&
          a.name !== 'bind:indeterminate' &&
          a.name !== 'bind:open' &&
          a.name !== 'bind:muted' &&
          a.name !== 'bind:paused' &&
          a.name !== 'bind:volume' &&
          a.name !== 'bind:currentTime' &&
          a.name !== 'bind:playbackRate' &&
          a.name !== 'bind:duration' &&
          a.name !== 'bind:ended' &&
          a.name !== 'bind:seeking' &&
          a.name !== 'bind:played' &&
          a.name !== 'bind:buffered' &&
          a.name !== 'bind:seekable' &&
          a.name !== 'bind:readyState' &&
          a.name !== 'bind:networkState' &&
          a.name !== 'bind:videoWidth' &&
          a.name !== 'bind:videoHeight' &&
          a.name !== 'bind:naturalWidth' &&
          a.name !== 'bind:naturalHeight' &&
          a.name !== 'bind:textContent' &&
          a.name !== 'bind:innerText'
        ) {
          throw new Error(
            `Unsupported binding "${a.name}" — only bind:value, bind:checked, bind:group, bind:this, bind:files, dimension binds, bind:scrollTop/Left, bind:selectionStart/End, bind:indeterminate, bind:open, media binds (muted/paused/volume/currentTime/playbackRate/duration/ended/seeking/played/buffered/seekable/readyState/networkState/videoWidth/videoHeight), bind:naturalWidth/Height on images, and bind:textContent/innerText on elements are supported`,
          )
        }
        continue
      }
      if (prefix === 'class') {
        if (ctx.component) {
          throw new Error(`class: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        const cls = a.name.slice('class:'.length)
        if (!cls) {
          throw new Error(`Invalid class: directive on <${ctx.tag}> — missing class name`)
        }
        continue
      }
      if (prefix === 'style') {
        if (ctx.component) {
          throw new Error(`style: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        const prop = a.name.slice('style:'.length)
        if (!prop) {
          throw new Error(`Invalid style: directive on <${ctx.tag}> — missing property name`)
        }
        continue
      }
      if (prefix === 'use') {
        if (ctx.component) {
          throw new Error(`use: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        const action = a.name.slice('use:'.length)
        if (!action || !/^[A-Za-z_$][\w$]*$/.test(action)) {
          throw new Error(
            `Invalid use: directive "${a.name}" on <${ctx.tag}> — action must be an identifier`,
          )
        }
        continue
      }
      if (prefix === 'transition' || prefix === 'in' || prefix === 'out') {
        if (ctx.component) {
          throw new Error(`${prefix}: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        parseTransitionDirective(a.name)
        continue
      }
      throw new Error(`Unsupported directive "${a.name}" on <${ctx.tag}>`)
    }
  }
}

/** Expression for an input's `value` (HTML default `"on"` when omitted). */
function inputValueExpr(attrs: Attr[]): string {
  const v = attrs.find((a) => a.name === 'value')
  if (!v) return jsLiteral('on')
  if (v.kind === 'expr') return `(${v.value})`
  if (v.value == null) return jsLiteral('')
  return jsLiteral(v.value)
}

/** True when `type="checkbox"` is a static attribute (dynamic type → radio-style group). */
function isStaticCheckbox(attrs: Attr[]): boolean {
  const t = attrs.find((a) => a.name === 'type')
  return !!t && t.kind === 'static' && t.value === 'checkbox'
}

/** Static `type="number"` / `type="range"` → bind:value as number (Svelte-like). */
function isNumericInput(attrs: Attr[]): boolean {
  const t = attrs.find((a) => a.name === 'type')
  return !!t && t.kind === 'static' && (t.value === 'number' || t.value === 'range')
}

/** SSR fragment for `bind:group` checked state. */
function emitSsrBindGroupChecked(groupExpr: string, attrs: Attr[]): string {
  const val = inputValueExpr(attrs)
  if (isStaticCheckbox(attrs)) {
    return `((Array.isArray(${groupExpr}) && ${groupExpr}.includes(${val})) ? ' checked' : '')`
  }
  return `((${groupExpr}) === ${val} ? ' checked' : '')`
}

/** Client sync for `bind:group` (radio scalar vs checkbox array). */
function emitClientBindGroup(groupExpr: string, id: string, attrs: Attr[], effectsVar: string): string {
  const val = inputValueExpr(attrs)
  if (isStaticCheckbox(attrs)) {
    return [
      `${effectsVar}.push(() => { ${id}.checked = Array.isArray(${groupExpr}) && ${groupExpr}.includes(${val}); });`,
      `${id}.addEventListener('change', () => { const __g = Array.isArray(${groupExpr}) ? ${groupExpr} : []; ${groupExpr} = ${id}.checked ? (__g.includes(${val}) ? __g : __g.concat([${val}])) : __g.filter((__x) => __x !== ${val}); __invalidate(); });`,
    ].join('\n')
  }
  return [
    `${effectsVar}.push(() => { ${id}.checked = (${groupExpr}) === ${val}; });`,
    `${id}.addEventListener('change', () => { if (${id}.checked) { ${groupExpr} = ${val}; __invalidate(); } });`,
  ].join('\n')
}

function classNameExpr(classAttrs: Attr[], classDirs: Attr[]): string {
  const parts: string[] = []
  for (const a of classAttrs) {
    if (a.kind === 'expr') parts.push(`((${a.value}) ?? '')`)
    else if (a.value != null) parts.push(jsLiteral(a.value))
  }
  for (const d of classDirs) {
    const cls = d.name.slice('class:'.length)
    parts.push(`((${d.value}) ? ${jsLiteral(cls)} : '')`)
  }
  return `[${parts.join(', ')}].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim()`
}

function partitionClassAttrs(attrs: Attr[]): {
  classAttrs: Attr[]
  classDirs: Attr[]
  rest: Attr[]
} {
  const classAttrs: Attr[] = []
  const classDirs: Attr[] = []
  const rest: Attr[] = []
  for (const a of attrs) {
    if (a.kind === 'class') classDirs.push(a)
    else if (a.name === 'class') classAttrs.push(a)
    else rest.push(a)
  }
  return { classAttrs, classDirs, rest }
}

/** SSR attribute fragment for ` class="…"` when class: is in play (omits when empty). */
function emitSsrClassAttrFragment(classAttrs: Attr[], classDirs: Attr[]): string {
  const expr = classNameExpr(classAttrs, classDirs)
  return `((() => { const __c = ${expr}; return __c ? (' class="' + __escape(__c) + '"') : ''; })())`
}

/** Build a runtime expression that evaluates to the final CSS text. */
function styleCssTextExpr(styleAttrs: Attr[], styleDirs: Attr[]): string {
  const parts: string[] = []
  for (const a of styleAttrs) {
    if (a.kind === 'expr') parts.push(`((${a.value}) ?? '')`)
    else if (a.value != null) parts.push(jsLiteral(a.value))
  }
  for (const d of styleDirs) {
    const prop = d.name.slice('style:'.length)
    parts.push(
      `((() => { const __v = (${d.value}); return (__v == null || __v === false) ? '' : (${jsLiteral(prop + ':')} + __v); })())`,
    )
  }
  return `[${parts.join(', ')}].filter(Boolean).join('; ').trim()`
}

function partitionStyleAttrs(attrs: Attr[]): {
  styleAttrs: Attr[]
  styleDirs: Attr[]
  rest: Attr[]
} {
  const styleAttrs: Attr[] = []
  const styleDirs: Attr[] = []
  const rest: Attr[] = []
  for (const a of attrs) {
    if (a.kind === 'style') styleDirs.push(a)
    else if (a.name === 'style') styleAttrs.push(a)
    else rest.push(a)
  }
  return { styleAttrs, styleDirs, rest }
}

/** SSR attribute fragment for ` style="…"` when style: is in play (omits when empty). */
function emitSsrStyleAttrFragment(styleAttrs: Attr[], styleDirs: Attr[]): string {
  const expr = styleCssTextExpr(styleAttrs, styleDirs)
  return `((() => { const __s = ${expr}; return __s ? (' style="' + __escape(__s) + '"') : ''; })())`
}

/** Build a component props object literal (SSR paths; client handles events itself). */
function componentPropsObject(
  t: Extract<Token, { type: 'component' }>,
  childrenExpr: string | null,
  slotsExpr: string | null = null,
): string {
  const hasSpread = t.attrs.some((a) => a.kind === 'spread')
  if (!hasSpread) {
    const entries: string[] = []
    for (const a of t.attrs) {
      if (a.kind === 'event') {
        const { propKey, modifiers } = parseEventDirective(a.name)
        const prelude = emitEventModifierPrelude(modifiers)
        if (a.value == null && modifiers.length === 0) {
          entries.push(`${jsLiteral(propKey)}: undefined`)
        } else if (modifiers.length === 0) {
          entries.push(`${jsLiteral(propKey)}: (${a.value})`)
        } else {
          const call =
            a.value != null
              ? `const __h = (${a.value}); return typeof __h === 'function' ? __h(...__a) : undefined;`
              : ''
          entries.push(
            `${jsLiteral(propKey)}: (...__a) => { const event = __a[0]; ${prelude} ${call} }`,
          )
        }
      } else if (a.kind === 'expr') {
        entries.push(`${jsLiteral(a.name)}: (${a.value})`)
      } else if (a.value == null) {
        entries.push(`${jsLiteral(a.name)}: true`)
      } else {
        entries.push(`${jsLiteral(a.name)}: ${jsLiteral(a.value)}`)
      }
    }
    if (childrenExpr != null) entries.push(`children: (${childrenExpr})`)
    if (slotsExpr != null) entries.push(`slots: (${slotsExpr})`)
    return `{ ${entries.join(', ')} }`
  }

  const chunks: string[] = []
  let pending: string[] = []
  const flushPending = () => {
    if (!pending.length) return
    chunks.push(`{ ${pending.join(', ')} }`)
    pending = []
  }
  for (const a of t.attrs) {
    if (a.kind === 'spread') {
      flushPending()
      chunks.push(`((${a.value}) || {})`)
      continue
    }
    if (a.kind === 'event') {
      const { propKey, modifiers } = parseEventDirective(a.name)
      const prelude = emitEventModifierPrelude(modifiers)
      if (a.value == null && modifiers.length === 0) {
        pending.push(`${jsLiteral(propKey)}: undefined`)
      } else if (modifiers.length === 0) {
        pending.push(`${jsLiteral(propKey)}: (${a.value})`)
      } else {
        const call =
          a.value != null
            ? `const __h = (${a.value}); return typeof __h === 'function' ? __h(...__a) : undefined;`
            : ''
        pending.push(
          `${jsLiteral(propKey)}: (...__a) => { const event = __a[0]; ${prelude} ${call} }`,
        )
      }
    } else if (a.kind === 'expr') {
      pending.push(`${jsLiteral(a.name)}: (${a.value})`)
    } else if (a.value == null) {
      pending.push(`${jsLiteral(a.name)}: true`)
    } else {
      pending.push(`${jsLiteral(a.name)}: ${jsLiteral(a.value)}`)
    }
  }
  flushPending()
  if (childrenExpr != null) chunks.push(`{ children: (${childrenExpr}) }`)
  if (slotsExpr != null) chunks.push(`{ slots: (${slotsExpr}) }`)
  return `Object.assign({}, ${chunks.join(', ')})`
}

function slotAttrName(token: Token): string | null {
  if (token.type !== 'element' && token.type !== 'component') return null
  const a = token.attrs.find((x) => x.name === 'slot')
  if (!a) return null
  if (a.kind !== 'static' || a.value == null || a.value === '') {
    throw new Error('slot= on projected content must be a static non-empty string')
  }
  return a.value
}

function withoutSlotAttr(token: Token): Token {
  if (token.type !== 'element' && token.type !== 'component') return token
  return { ...token, attrs: token.attrs.filter((a) => a.name !== 'slot') }
}

function partitionSlotChildren(children: Token[]): {
  defaultChildren: Token[]
  named: Map<string, Token[]>
} {
  const defaultChildren: Token[] = []
  const named = new Map<string, Token[]>()
  for (const child of children) {
    if (child.type === 'text' && !child.value.trim()) continue
    const name = slotAttrName(child)
    if (name) {
      const list = named.get(name) ?? []
      list.push(withoutSlotAttr(child))
      named.set(name, list)
    } else {
      defaultChildren.push(child)
    }
  }
  return { defaultChildren, named }
}

function emitSsrSlotBag(named: Map<string, Token[]>, hash: string): string | null {
  if (named.size === 0) return null
  const entries: string[] = []
  for (const [name, tokens] of named) {
    entries.push(`${jsLiteral(name)}: (${emitSsr(tokens, hash)})`)
  }
  return `{ ${entries.join(', ')} }`
}

function emitSlotContentExpr(
  t: Extract<Token, { type: 'slot' }>,
  hash: string,
): string {
  const fallback = t.fallback.length ? emitSsr(t.fallback, hash) : '``'
  if (t.name) {
    return `((__props.slots && __props.slots[${jsLiteral(t.name)}]) ?? (${fallback}))`
  }
  return `((__props.children != null && __props.children !== '') ? __props.children : (${fallback}))`
}

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** SVG tags created with `createElementNS` (HTML tags still use `createElement`). */
const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'defs',
  'clipPath',
  'mask',
  'use',
  'symbol',
  'marker',
  'pattern',
  'image',
  'foreignObject',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feSpecularLighting',
  'feTile',
  'feTurbulence',
  'title',
  'desc',
  'metadata',
  'switch',
  'view',
  'animate',
  'animateMotion',
  'animateTransform',
  'set',
  'mpath',
])

function isSvgTag(tag: string): boolean {
  return SVG_TAGS.has(tag)
}

/** Create in SVG namespace when the tag is `<svg>` or a known SVG tag under an SVG parent. */
function shouldCreateSvg(tag: string, inSvg: boolean): boolean {
  return tag === 'svg' || (inSvg && isSvgTag(tag))
}

function emitCreateElement(tag: string, inSvg: boolean): string {
  if (shouldCreateSvg(tag, inSvg)) {
    return `document.createElementNS(${jsLiteral(SVG_NS)}, ${jsLiteral(tag)})`
  }
  return `document.createElement(${jsLiteral(tag)})`
}

/** Children of `<foreignObject>` are HTML; children of other SVG parents stay in SVG. */
function childSvgContext(tag: string, inSvg: boolean): boolean {
  if (tag === 'svg') return true
  if (tag === 'foreignObject') return false
  return inSvg
}

/** HTML boolean attributes — presence means true; omit when the expression is falsy. */
const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
])

function isBooleanAttr(name: string): boolean {
  return BOOLEAN_ATTRS.has(name.toLowerCase())
}

/** SSR fragment for `{...obj}` — skips `on*` and directive-like keys (`:`). */
function emitSsrSpreadAttrFragment(expr: string): string {
  return `((__sp) => {
    if (!__sp || typeof __sp !== 'object') return '';
    let __o = '';
    for (const __k of Object.keys(__sp)) {
      if (/^on/i.test(__k) || __k.indexOf(':') !== -1) continue;
      const __v = __sp[__k];
      if (__v == null || __v === false) continue;
      if (__v === true) __o += ' ' + __k;
      else __o += ' ' + __k + '="' + __escape(__v) + '"';
    }
    return __o;
  })(${expr})`
}

/** Client effect for `{...obj}` — applies attrs and clears removed keys. */
function emitClientSpread(a: Attr, id: string, effectsVar: string): string {
  return `{
    let __spreadKeys = [];
    ${effectsVar}.push(() => {
      const __sp = (${a.value}) || {};
      const __next = [];
      for (const __k of Object.keys(__sp)) {
        if (/^on/i.test(__k) || __k.indexOf(':') !== -1) continue;
        const __v = __sp[__k];
        if (__v == null || __v === false) {
          ${id}.removeAttribute(__k);
          continue;
        }
        __next.push(__k);
        if (__v === true) ${id}.setAttribute(__k, '');
        else ${id}.setAttribute(__k, String(__v));
      }
      for (const __k of __spreadKeys) {
        if (__next.indexOf(__k) === -1) ${id}.removeAttribute(__k);
      }
      __spreadKeys = __next;
    });
  }`
}

/** Mark <option> children selected when a parent <select> uses bind:value. */
function optionsWithBoundSelected(
  children: Token[],
  bindExpr: string,
  multiple = false,
): Token[] {
  return children.map((t) => {
    if (t.type !== 'element' || t.tag.toLowerCase() !== 'option') return t
    if (t.attrs.some((a) => a.name === 'selected')) return t
    const valAttr = t.attrs.find((a) => a.name === 'value')
    let cmp: string
    if (!valAttr || valAttr.value == null) {
      cmp = "''"
    } else if (valAttr.kind === 'expr') {
      cmp = `(${valAttr.value})`
    } else {
      cmp = jsLiteral(valAttr.value)
    }
    const selectedExpr = multiple
      ? `(Array.isArray(${bindExpr}) && ${bindExpr}.some((__v) => Object.is(__v, ${cmp})))`
      : `Object.is(${bindExpr}, ${cmp})`
    return {
      ...t,
      attrs: [
        ...t.attrs,
        { name: 'selected', value: selectedExpr, kind: 'expr' as const },
      ],
    }
  })
}

function selectBindValueExpr(attrs: Attr[]): string | null {
  const a = attrs.find((x) => x.kind === 'bind' && x.name === 'bind:value')
  return a?.value ?? null
}

function isStaticMultiple(attrs: Attr[]): boolean {
  const m = attrs.find((a) => a.name === 'multiple')
  return !!m && m.kind !== 'expr' && m.kind !== 'bind'
}

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

/**
 * Parse `{#if}` / `{:else if}` / `{:else}` / `{/if}` into a nested if-token chain.
 * `{:else if cond}` becomes `else: [{ type:'if', cond, ... }]`.
 */
function parseIfChain(
  cond: string,
  input: string,
  start: number,
): { token: Extract<Token, { type: 'if' }>; next: number } {
  let i = start
  const { body, rest } = readBlock(input.slice(i), ['{:else', '{/if}'])
  i += body.consumed
  const then = tokenize(body.raw)
  let elseBody: Token[] | undefined
  if (rest.startsWith('{:else if ')) {
    const nextCond = rest.slice('{:else if '.length, -1).trim()
    if (!nextCond) throw new Error('{:else if} requires a condition')
    const nested = parseIfChain(nextCond, input, i)
    elseBody = [nested.token]
    i = nested.next
  } else if (rest === '{:else}') {
    const elseBlock = readBlock(input.slice(i), ['{/if}'])
    elseBody = tokenize(elseBlock.body.raw)
    i += elseBlock.body.consumed
  } else if (rest !== '{/if}') {
    throw new Error(`Unexpected if branch terminator: ${rest}`)
  }
  return { token: { type: 'if', cond, then, else: elseBody }, next: i }
}

/** Flatten nested `{:else if}` if-tokens into ordered branches + final else. */
function flattenIfBranches(t: Extract<Token, { type: 'if' }>): {
  branches: { cond: string; body: Token[] }[]
  elseBody?: Token[]
} {
  const branches: { cond: string; body: Token[] }[] = [{ cond: t.cond, body: t.then }]
  let elseBody = t.else
  while (elseBody && elseBody.length === 1 && elseBody[0]!.type === 'if') {
    const nested = elseBody[0] as Extract<Token, { type: 'if' }>
    branches.push({ cond: nested.cond, body: nested.then })
    elseBody = nested.else
  }
  return { branches, elseBody }
}

function emitClientIfBranches(
  t: Extract<Token, { type: 'if' }>,
  hash: string,
  frag: string,
  effectsVar: string,
  inSvg = false,
): string {
  const { branches, elseBody } = flattenIfBranches(t)
  const parts: string[] = []
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]!
    const kw = i === 0 ? 'if' : 'else if'
    parts.push(`${kw} (${b.cond}) {\n${emitClientNodes(b.body, hash, frag, effectsVar, inSvg)}\n}`)
  }
  if (elseBody) {
    parts.push(`else {\n${emitClientNodes(elseBody, hash, frag, effectsVar, inSvg)}\n}`)
  }
  return parts.join(' ')
}

function readBlock(
  input: string,
  terminators: string[],
): { body: { raw: string; consumed: number }; rest?: string } {
  let depthIf = 0
  let depthEach = 0
  let depthAwait = 0
  let depthKey = 0
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
    if (input.startsWith('{#key ', i)) {
      depthKey++
      i += 6
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
    if (input.startsWith('{/key}', i)) {
      if (depthKey === 0 && terminators.includes('{/key}')) {
        return { body: { raw: input.slice(0, i), consumed: i + 6 }, rest: '{/key}' }
      }
      depthKey--
      i += 6
      continue
    }
    if (
      depthIf === 0 &&
      depthEach === 0 &&
      depthAwait === 0 &&
      depthKey === 0 &&
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
    if (s[i] === '{') {
      const inner = readBalanced('{', '}').trim()
      if (!inner.startsWith('...')) {
        throw new Error(
          `Invalid bare attribute expression "{${inner}}" — use name={expr} or {...obj}`,
        )
      }
      const expr = inner.slice(3).trim()
      if (!expr) throw new Error(`Invalid spread attribute "{...}"`)
      attrs.push({ name: '{...}', value: expr, kind: 'spread' })
      continue
    }
    const nameStart = i
    while (i < s.length && /[^\s=]/.test(s[i])) i++
    const name = s.slice(nameStart, i)
    if (!name) break
    skipWs()
    if (s[i] !== '=') {
      if (name.startsWith('class:')) {
        const cls = name.slice('class:'.length)
        if (!cls) throw new Error(`Invalid class: directive — missing class name`)
        if (!/^[A-Za-z_$][\w$]*$/.test(cls)) {
          throw new Error(
            `class:${cls} shorthand requires a matching identifier; use class:${cls}={expr}`,
          )
        }
        attrs.push({ name, value: cls, kind: 'class' })
        continue
      }
      if (name.startsWith('style:')) {
        const prop = name.slice('style:'.length)
        if (!prop) throw new Error(`Invalid style: directive — missing property name`)
        if (!/^[A-Za-z_$][\w$]*$/.test(prop)) {
          throw new Error(
            `style:${prop} shorthand requires a matching identifier; use style:${prop}={expr}`,
          )
        }
        attrs.push({ name, value: prop, kind: 'style' })
        continue
      }
      if (name.startsWith('use:')) {
        const action = name.slice('use:'.length)
        if (!action || !/^[A-Za-z_$][\w$]*$/.test(action)) {
          throw new Error(`Invalid use: directive "${name}" — action must be an identifier`)
        }
        attrs.push({ name, value: null, kind: 'use' })
        continue
      }
      if (name.startsWith('transition:') || name.startsWith('in:') || name.startsWith('out:')) {
        parseTransitionDirective(name)
        attrs.push({ name, value: null, kind: 'transition' })
        continue
      }
      if (name.startsWith('on:')) {
        parseEventDirective(name) // validate modifiers early
        attrs.push({ name, value: null, kind: 'event' })
        continue
      }
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
      parseEventDirective(name)
      attrs.push({ name, value, kind: 'event' })
    } else if (name.startsWith('bind:')) {
      attrs.push({ name, value, kind: 'bind' })
    } else if (name.startsWith('class:')) {
      if (kind !== 'expr') {
        throw new Error(`class: directives require an expression: ${name}={...}`)
      }
      attrs.push({ name, value, kind: 'class' })
    } else if (name.startsWith('style:')) {
      if (kind !== 'expr') {
        throw new Error(`style: directives require an expression: ${name}={...}`)
      }
      attrs.push({ name, value, kind: 'style' })
    } else if (name.startsWith('use:')) {
      if (kind !== 'expr') {
        throw new Error(`use: directives with parameters require an expression: ${name}={...}`)
      }
      const action = name.slice('use:'.length)
      if (!action || !/^[A-Za-z_$][\w$]*$/.test(action)) {
        throw new Error(`Invalid use: directive "${name}" — action must be an identifier`)
      }
      attrs.push({ name, value, kind: 'use' })
    } else if (name.startsWith('transition:') || name.startsWith('in:') || name.startsWith('out:')) {
      const { type } = parseTransitionDirective(name)
      if (kind !== 'expr') {
        throw new Error(`${name.split(':')[0]}:${type} parameters require an expression: ${name}={...}`)
      }
      attrs.push({ name, value, kind: 'transition' })
    } else if (kind === 'expr') {
      // Dynamic HTML event attrs (onclick={...}) are XSS sinks; require on:click.
      if (/^on[a-z]/i.test(name)) {
        const ev = name.slice(2)
        throw new Error(
          `Dynamic event attribute "${name}={...}" is not allowed; use on:${ev.toLowerCase()}={...}`,
        )
      }
      attrs.push({ name, value, kind: 'expr' })
    } else {
      attrs.push({ name, value, kind: 'static' })
    }
  }
  return attrs
}

function emitSsr(tokens: Token[], hash: string): string {
  const parts: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'const') {
      const rest = emitSsr(tokens.slice(i + 1), hash)
      parts.push(`((${t.name}) => (${rest}))(${t.value})`)
      break
    } else if (t.type === 'text') {
      parts.push('`' + escapeForTemplateLiteral(t.value) + '`')
    } else if (t.type === 'slot') {
      parts.push(emitSlotContentExpr(t, hash))
    } else if (t.type === 'html') {
      parts.push(`(${t.value})`)
    } else if (t.type === 'expr') {
      parts.push(`__escape(${t.value})`)
    } else if (t.type === 'if') {
      const thenExpr = emitSsr(t.then, hash)
      const elseExpr = t.else ? emitSsr(t.else, hash) : '``'
      parts.push(`((${t.cond}) ? (${thenExpr}) : (${elseExpr}))`)
    } else if (t.type === 'each') {
      const body = emitSsr(t.body, hash)
      const idx = t.index ? `, ${t.index}` : ''
      const mapExpr = `__list.map((${t.item}${idx}) => (${body})).join('')`
      if (t.else) {
        const elseExpr = emitSsr(t.else, hash)
        parts.push(
          `(((__list) => __list.length ? (${mapExpr}) : (${elseExpr}))((${t.list}) || []))`,
        )
      } else {
        parts.push(`((${t.list}) || []).map((${t.item}${idx}) => (${body})).join('')`)
      }
    } else if (t.type === 'key') {
      // Key only affects client remount; SSR renders the body once.
      parts.push(`(${emitSsr(t.body, hash)})`)
    } else if (t.type === 'await') {
      // Sync render(): pending branch if present; streaming path uses emitSsrStream
      parts.push(t.pending?.length ? `(${emitSsr(t.pending, hash)})` : '``')
    } else if (t.type === 'component') {
      const { defaultChildren, named } = partitionSlotChildren(t.children)
      const childrenExpr =
        t.selfClosing || defaultChildren.length === 0 ? null : emitSsr(defaultChildren, hash)
      const slotsExpr = emitSsrSlotBag(named, hash)
      parts.push(`${t.name}.render(${componentPropsObject(t, childrenExpr, slotsExpr)})`)
    } else if (t.type === 'element') {
      parts.push(emitSsrElement(t, hash))
    }
  }
  return parts.length ? parts.join(' + ') : '``'
}

/** Statement-based SSR for out-of-order streaming (`__enqueue`, `__awaitBoundary`). */
function emitSsrStream(tokens: Token[], hash: string): string {
  const lines: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'const') {
      lines.push(
        `{\n  const ${t.name} = (${t.value});\n${indentStream(emitSsrStream(tokens.slice(i + 1), hash))}\n}`,
      )
      break
    } else if (t.type === 'text') {
      lines.push(`__enqueue(\`${escapeForTemplateLiteral(t.value)}\`);`)
    } else if (t.type === 'slot') {
      lines.push(`await __pipeChildren(${emitSlotContentExpr(t, hash)});`)
    } else if (t.type === 'html') {
      lines.push(`__enqueue(${t.value});`)
    } else if (t.type === 'expr') {
      lines.push(`__enqueue(__escape(${t.value}));`)
    } else if (t.type === 'if') {
      const { branches, elseBody } = flattenIfBranches(t)
      const parts: string[] = []
      for (let bi = 0; bi < branches.length; bi++) {
        const b = branches[bi]!
        const kw = bi === 0 ? 'if' : 'else if'
        parts.push(`${kw} (${b.cond}) {\n${indentStream(emitSsrStream(b.body, hash))}\n}`)
      }
      if (elseBody) {
        parts.push(`else {\n${indentStream(emitSsrStream(elseBody, hash))}\n}`)
      } else if (branches.length === 1) {
        parts.push(`else {\n}`)
      }
      lines.push(parts.join(' '))
    } else if (t.type === 'each') {
      const body = emitSsrStream(t.body, hash)
      const elsePart = t.else
        ? ` else {\n${indentStream(emitSsrStream(t.else, hash))}\n}`
        : ''
      if (t.index) {
        lines.push(
          `{\n  const __list = (${t.list}) || [];\n  if (__list.length) {\n    let ${t.index} = 0;\n    for (const ${t.item} of __list) {\n${indentStream(body)}\n      ${t.index}++;\n    }\n  }${elsePart}\n}`,
        )
      } else if (t.else) {
        lines.push(
          `{\n  const __list = (${t.list}) || [];\n  if (__list.length) {\n    for (const ${t.item} of __list) {\n${indentStream(body)}\n    }\n  }${elsePart}\n}`,
        )
      } else {
        lines.push(
          `for (const ${t.item} of ((${t.list}) || [])) {\n${indentStream(body)}\n}`,
        )
      }
    } else if (t.type === 'key') {
      lines.push(emitSsrStream(t.body, hash))
    } else if (t.type === 'await') {
      const thenBody = emitSsrStream(t.thenBody, hash)
      const catchPart = t.catchBody
        ? `, async (${t.catchName ?? 'error'}, __enqueue) => {\n` +
          `  const __awaitBoundary = (p, t, c, e, pend) => __ctrl.enqueueBoundary(p, t, c, e, pend);\n` +
          `${indentStream(emitSsrStream(t.catchBody, hash))}\n}`
        : ', undefined'
      const pendingExpr = t.pending?.length ? `(${emitSsr(t.pending, hash)})` : '``'
      lines.push(
        `__awaitBoundary(Promise.resolve(${t.promise}), async (${t.thenName}, __enqueue) => {\n` +
          `  const __awaitBoundary = (p, t, c, e, pend) => __ctrl.enqueueBoundary(p, t, c, e, pend);\n` +
          `${indentStream(thenBody)}\n}${catchPart}, undefined, ${pendingExpr});`,
      )
    } else if (t.type === 'component') {
      // v1: slotted content is materialized synchronously (no OOO boundaries inside components)
      const { defaultChildren, named } = partitionSlotChildren(t.children)
      const childrenExpr =
        t.selfClosing || defaultChildren.length === 0 ? null : emitSsr(defaultChildren, hash)
      const slotsExpr = emitSsrSlotBag(named, hash)
      lines.push(`__enqueue(${t.name}.render(${componentPropsObject(t, childrenExpr, slotsExpr)}));`)
    } else if (t.type === 'element') {
      lines.push(emitSsrStreamElement(t, hash))
    }
  }
  return lines.join('\n')
}

function indentStream(code: string): string {
  if (!code.trim()) return ''
  return code
    .split('\n')
    .map((l) => (l.trim() ? '  ' + l : l))
    .join('\n')
}

function emitSsrStreamElement(el: Token & { type: 'element' }, hash: string): string {
  const { classAttrs, classDirs, rest: afterClass } = partitionClassAttrs(el.attrs)
  const { styleAttrs, styleDirs, rest } = partitionStyleAttrs(afterClass)
  const attrParts: string[] = [`\` ${hash}\``]
  if (classDirs.length) {
    attrParts.push(emitSsrClassAttrFragment(classAttrs, classDirs))
  } else {
    for (const a of classAttrs) {
      if (a.kind === 'expr') {
        attrParts.push(`\` class="\` + __escape(${a.value}) + \`"\``)
      } else if (a.value == null) {
        attrParts.push('` class`')
      } else {
        attrParts.push('`' + escapeForTemplateLiteral(` class="${a.value}"`) + '`')
      }
    }
  }
  if (styleDirs.length) {
    attrParts.push(emitSsrStyleAttrFragment(styleAttrs, styleDirs))
  } else {
    for (const a of styleAttrs) {
      if (a.kind === 'expr') {
        attrParts.push(`\` style="\` + __escape(${a.value}) + \`"\``)
      } else if (a.value == null) {
        attrParts.push('` style`')
      } else {
        attrParts.push('`' + escapeForTemplateLiteral(` style="${a.value}"`) + '`')
      }
    }
  }
  for (const a of rest) {
    if (a.kind === 'event' || a.kind === 'use' || a.kind === 'transition') continue
    if (a.kind === 'spread') {
      attrParts.push(emitSsrSpreadAttrFragment(a.value!))
      continue
    }
    // Never emit raw HTML event handlers (static or dynamic).
    if (/^on[a-z]/i.test(a.name)) continue
    if (a.kind === 'bind' && a.name === 'bind:value') {
      attrParts.push(`\` value="\` + __escape(${a.value}) + \`"\``)
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:checked') {
      attrParts.push(`((${a.value}) ? ' checked' : '')`)
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:group') {
      attrParts.push(emitSsrBindGroupChecked(a.value!, el.attrs))
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:this') continue
    if (a.kind === 'bind' && a.name === 'bind:files') continue
    if (
      a.kind === 'bind' &&
      (a.name === 'bind:clientWidth' ||
        a.name === 'bind:clientHeight' ||
        a.name === 'bind:offsetWidth' ||
        a.name === 'bind:offsetHeight' ||
        a.name === 'bind:scrollTop' ||
        a.name === 'bind:scrollLeft' ||
        a.name === 'bind:selectionStart' ||
        a.name === 'bind:selectionEnd' ||
        a.name === 'bind:indeterminate')
    ) {
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:open') {
      attrParts.push(`((${a.value}) ? ' open' : '')`)
      continue
    }
    if (a.kind === 'bind' && (a.name === 'bind:muted' || a.name === 'bind:paused')) continue
    if (a.kind === 'bind' && (a.name === 'bind:volume' || a.name === 'bind:currentTime')) continue
    if (a.kind === 'bind' && (a.name === 'bind:playbackRate' || a.name === 'bind:duration')) continue
    if (a.kind === 'bind' && (a.name === 'bind:ended' || a.name === 'bind:seeking')) continue
    if (a.kind === 'bind' && (a.name === 'bind:played' || a.name === 'bind:buffered' || a.name === 'bind:seekable')) continue
    if (a.kind === 'bind' && (a.name === 'bind:readyState' || a.name === 'bind:networkState')) continue
    if (a.kind === 'bind' && (a.name === 'bind:videoWidth' || a.name === 'bind:videoHeight')) continue
    if (a.kind === 'bind' && (a.name === 'bind:naturalWidth' || a.name === 'bind:naturalHeight')) continue
    if (a.kind === 'bind' && (a.name === 'bind:textContent' || a.name === 'bind:innerText')) continue
    if (a.kind === 'expr') {
      if (isBooleanAttr(a.name)) {
        attrParts.push(`((${a.value}) ? ' ${a.name}' : '')`)
      } else {
        attrParts.push(`\` ${a.name}="\` + __escape(${a.value}) + \`"\``)
      }
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
  const lines = [`__enqueue(${open});`]
  if (!el.selfClosing && !VOID.has(el.tag.toLowerCase())) {
    const bindSelect = el.tag.toLowerCase() === 'select' ? selectBindValueExpr(el.attrs) : null
    const childTokens = bindSelect
      ? optionsWithBoundSelected(el.children, bindSelect, isStaticMultiple(el.attrs))
      : el.children
    const children = emitSsrStream(childTokens, hash)
    if (children.trim()) lines.push(children)
    lines.push(`__enqueue(\`${escapeForTemplateLiteral(`</${el.tag}>`)}\`);`)
  }
  return lines.join('\n')
}

function emitSsrElement(el: Token & { type: 'element' }, hash: string): string {
  const { classAttrs, classDirs, rest: afterClass } = partitionClassAttrs(el.attrs)
  const { styleAttrs, styleDirs, rest } = partitionStyleAttrs(afterClass)
  const attrParts: string[] = [`\` ${hash}\``]
  if (classDirs.length) {
    attrParts.push(emitSsrClassAttrFragment(classAttrs, classDirs))
  } else {
    for (const a of classAttrs) {
      if (a.kind === 'expr') {
        attrParts.push(`\` class="\` + __escape(${a.value}) + \`"\``)
      } else if (a.value == null) {
        attrParts.push('` class`')
      } else {
        attrParts.push('`' + escapeForTemplateLiteral(` class="${a.value}"`) + '`')
      }
    }
  }
  if (styleDirs.length) {
    attrParts.push(emitSsrStyleAttrFragment(styleAttrs, styleDirs))
  } else {
    for (const a of styleAttrs) {
      if (a.kind === 'expr') {
        attrParts.push(`\` style="\` + __escape(${a.value}) + \`"\``)
      } else if (a.value == null) {
        attrParts.push('` style`')
      } else {
        attrParts.push('`' + escapeForTemplateLiteral(` style="${a.value}"`) + '`')
      }
    }
  }
  for (const a of rest) {
    if (a.kind === 'event' || a.kind === 'use' || a.kind === 'transition') continue
    if (a.kind === 'spread') {
      attrParts.push(emitSsrSpreadAttrFragment(a.value!))
      continue
    }
    // Never emit raw HTML event handlers (static or dynamic).
    if (/^on[a-z]/i.test(a.name)) continue
    if (a.kind === 'bind' && a.name === 'bind:value') {
      attrParts.push(`\` value="\` + __escape(${a.value}) + \`"\``)
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:checked') {
      attrParts.push(`((${a.value}) ? ' checked' : '')`)
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:group') {
      attrParts.push(emitSsrBindGroupChecked(a.value!, el.attrs))
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:this') continue
    if (a.kind === 'bind' && a.name === 'bind:files') continue
    if (
      a.kind === 'bind' &&
      (a.name === 'bind:clientWidth' ||
        a.name === 'bind:clientHeight' ||
        a.name === 'bind:offsetWidth' ||
        a.name === 'bind:offsetHeight' ||
        a.name === 'bind:scrollTop' ||
        a.name === 'bind:scrollLeft' ||
        a.name === 'bind:selectionStart' ||
        a.name === 'bind:selectionEnd' ||
        a.name === 'bind:indeterminate')
    ) {
      continue
    }
    if (a.kind === 'bind' && a.name === 'bind:open') {
      attrParts.push(`((${a.value}) ? ' open' : '')`)
      continue
    }
    if (a.kind === 'bind' && (a.name === 'bind:muted' || a.name === 'bind:paused')) continue
    if (a.kind === 'bind' && (a.name === 'bind:volume' || a.name === 'bind:currentTime')) continue
    if (a.kind === 'bind' && (a.name === 'bind:playbackRate' || a.name === 'bind:duration')) continue
    if (a.kind === 'bind' && (a.name === 'bind:ended' || a.name === 'bind:seeking')) continue
    if (a.kind === 'bind' && (a.name === 'bind:played' || a.name === 'bind:buffered' || a.name === 'bind:seekable')) continue
    if (a.kind === 'bind' && (a.name === 'bind:readyState' || a.name === 'bind:networkState')) continue
    if (a.kind === 'bind' && (a.name === 'bind:videoWidth' || a.name === 'bind:videoHeight')) continue
    if (a.kind === 'bind' && (a.name === 'bind:naturalWidth' || a.name === 'bind:naturalHeight')) continue
    if (a.kind === 'bind' && (a.name === 'bind:textContent' || a.name === 'bind:innerText')) continue
    if (a.kind === 'expr') {
      if (isBooleanAttr(a.name)) {
        attrParts.push(`((${a.value}) ? ' ${a.name}' : '')`)
      } else {
        attrParts.push(`\` ${a.name}="\` + __escape(${a.value}) + \`"\``)
      }
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
  const bindSelect = el.tag.toLowerCase() === 'select' ? selectBindValueExpr(el.attrs) : null
  const childTokens = bindSelect
    ? optionsWithBoundSelected(el.children, bindSelect, isStaticMultiple(el.attrs))
    : el.children
  const children = emitSsr(childTokens, hash)
  return `(${open}) + (${children}) + (` + '`' + escapeForTemplateLiteral(`</${el.tag}>`) + '`)'
}

function emitClient(tokens: Token[], hash: string): string {
  return `const __root = document.createDocumentFragment();\n${emitClientNodes(tokens, hash, '__root')}\ntarget.appendChild(__root);\n`
}

function emitClientNodes(
  tokens: Token[],
  hash: string,
  parent: string,
  effectsVar = '__effects',
  inSvg = false,
): string {
  const lines: string[] = []
  let n = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const id = `${parent}_n${n++}`
    if (t.type === 'const') {
      lines.push(`{
        const ${t.name} = (${t.value});
        ${emitClientNodes(tokens.slice(i + 1), hash, parent, effectsVar, inSvg)}
      }`)
      break
    }
    if (t.type === 'text') {
      lines.push(`{ const ${id} = document.createTextNode(${jsLiteral(t.value)}); ${parent}.appendChild(${id}); }`)
    } else if (t.type === 'slot') {
      // Layout/slot content is a trusted framework contract (SSR HTML or Node).
      // Public mount/update must not pass untrusted strings — see docs/security.md.
      const contentExpr = t.name
        ? `(__props.slots && __props.slots[${jsLiteral(t.name)}])`
        : `__props.children`
      const fallbackBlock = t.fallback.length
        ? `{
            const __frag = document.createDocumentFragment();
            ${emitClientNodes(t.fallback, hash, '__frag', effectsVar, inSvg)}
            ${parent}.appendChild(__frag);
          }`
        : ''
      lines.push(`{
        // trusted framework HTML or Node — see docs/security.md
        const __ch = ${contentExpr};
        if (__ch instanceof Node) {
          ${parent}.appendChild(__ch);
        } else if (__ch != null && __ch !== '') {
          const ${id} = document.createElement('template');
          ${id}.innerHTML = String(__ch);
          ${parent}.appendChild(${id}.content);
        } else ${fallbackBlock || '{}'}
      }`)
    } else if (t.type === 'html') {
      lines.push(`{
        // trusted HTML — {@html}; see docs/security.md
        const ${id} = document.createElement('template');
        ${id}.innerHTML = String(${t.value} ?? '');
        ${parent}.appendChild(${id}.content);
      }`)
    } else if (t.type === 'expr') {
      lines.push(`{
        const ${id} = document.createTextNode('');
        ${parent}.appendChild(${id});
        ${effectsVar}.push(() => { ${id}.data = String(${t.value} ?? ''); });
      }`)
    } else if (t.type === 'if') {
      lines.push(`{
        const ${id} = document.createComment('if');
        ${parent}.appendChild(${id});
        let __anchor = ${id};
        let __nodes = [];
        let __blockEffects = [];
        let __blockCleanups = [];
        let __outroGen = 0;
        ${effectsVar}.push(() => {
          const __g = ++__outroGen;
          const __leaving = __nodes;
          const __leavingCleanups = __blockCleanups;
          __nodes = [];
          __blockEffects = [];
          __blockCleanups = [];
          const __enter = () => {
            if (__g !== __outroGen) return;
            const __frag = document.createDocumentFragment();
            {
              const __effects = __blockEffects;
              const __cleanups = __blockCleanups;
              ${emitClientIfBranches(t, hash, '__frag', '__effects', inSvg)}
            }
            let __insertBefore = __anchor.nextSibling;
            while (__frag.firstChild) {
              __nodes.push(__frag.firstChild);
              __anchor.parentNode.insertBefore(__frag.firstChild, __insertBefore);
            }
            for (const fn of __blockEffects) fn();
          };
          for (const __c of __leavingCleanups) { try { __c(); } catch {} }
          __runOutro(__leaving, __enter);
        });
      }`)
    } else if (t.type === 'each' && t.key) {
      const idx = t.index ?? '__i'
      const compareIndex = t.index ? ` && __rec.index === ${idx}` : ''
      const elseEnter = t.else
        ? `
          __blockEffects = [];
          __elseCleanups = [];
          const __frag = document.createDocumentFragment();
          {
            const __effects = __blockEffects;
            const __cleanups = __elseCleanups;
            ${emitClientNodes(t.else, hash, '__frag', '__effects', inSvg)}
          }
          let __insertBefore = ${id}.nextSibling;
          while (__frag.firstChild) {
            __elseNodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
          }
          for (const fn of __blockEffects) fn();`
        : ''
      lines.push(`{
        const ${id} = document.createComment('each-keyed');
        ${parent}.appendChild(${id});
        let __records = [];
        let __elseNodes = [];
        let __elseCleanups = [];
        let __blockEffects = [];
        let __outroGen = 0;
        ${effectsVar}.push(() => {
          const __g = ++__outroGen;
          const __list = ((${t.list}) || []);
          if (!__list.length) {
            const __leaving = [];
            const __leavingCleanups = [];
            for (const __rec of __records) {
              for (const n of __rec.nodes) __leaving.push(n);
              for (const c of __rec.cleanups) __leavingCleanups.push(c);
            }
            for (const n of __elseNodes) __leaving.push(n);
            for (const c of __elseCleanups) __leavingCleanups.push(c);
            __records = [];
            __elseNodes = [];
            __elseCleanups = [];
            for (const __c of __leavingCleanups) { try { __c(); } catch {} }
            __runOutro(__leaving, () => {
              if (__g !== __outroGen) return;
              ${elseEnter}
            });
            return;
          }
          const __leavingElse = __elseNodes;
          const __leavingElseCleanups = __elseCleanups;
          __elseNodes = [];
          __elseCleanups = [];
          const __oldByKey = new Map(__records.map((__r) => [__r.key, __r]));
          const __nextRecords = [];
          const __seenKeys = new Set();
          const __leaving = [];
          const __leavingCleanups = [];
          for (const n of __leavingElse) __leaving.push(n);
          for (const c of __leavingElseCleanups) __leavingCleanups.push(c);
          __list.forEach((${t.item}, ${idx}) => {
            const __key = (${t.key});
            if (__seenKeys.has(__key)) throw new Error('Duplicate key in {#each}: ' + String(__key));
            __seenKeys.add(__key);
            let __rec = __oldByKey.get(__key);
            if (__rec && Object.is(__rec.value, ${t.item})${compareIndex}) {
              __oldByKey.delete(__key);
              __rec.index = ${idx};
              __nextRecords.push(__rec);
              return;
            }
            if (__rec) {
              for (const n of __rec.nodes) __leaving.push(n);
              for (const c of __rec.cleanups) __leavingCleanups.push(c);
              __oldByKey.delete(__key);
            }
            const __frag = document.createDocumentFragment();
            const __blockEffects = [];
            const __blockCleanups = [];
            {
              const __effects = __blockEffects;
              const __cleanups = __blockCleanups;
              ${emitClientNodes(t.body, hash, '__frag', '__effects', inSvg)}
            }
            __rec = {
              key: __key,
              value: ${t.item},
              index: ${idx},
              nodes: Array.from(__frag.childNodes),
              effects: __blockEffects,
              cleanups: __blockCleanups,
            };
            __nextRecords.push(__rec);
          });
          for (const __rec of __oldByKey.values()) {
            for (const n of __rec.nodes) __leaving.push(n);
            for (const c of __rec.cleanups) __leavingCleanups.push(c);
          }
          const __leavingSet = new Set(__leaving);
          let __cursor = ${id}.nextSibling;
          while (__cursor && __leavingSet.has(__cursor)) __cursor = __cursor.nextSibling;
          for (const __rec of __nextRecords) {
            for (const n of __rec.nodes) {
              while (__cursor && __leavingSet.has(__cursor)) __cursor = __cursor.nextSibling;
              if (n === __cursor) __cursor = __cursor.nextSibling;
              else ${id}.parentNode.insertBefore(n, __cursor);
            }
          }
          __records = __nextRecords;
          for (const __rec of __records) {
            for (const fn of __rec.effects) fn();
          }
          for (const __c of __leavingCleanups) { try { __c(); } catch {} }
          __runOutro(__leaving, () => {});
        });
      }`)
    } else if (t.type === 'each') {
      const idx = t.index ?? '__i'
      const elseBranch = t.else
        ? ` else {
              ${emitClientNodes(t.else, hash, '__frag', '__effects', inSvg)}
            }`
        : ''
      lines.push(`{
        const ${id} = document.createComment('each');
        ${parent}.appendChild(${id});
        let __nodes = [];
        let __blockEffects = [];
        let __blockCleanups = [];
        let __outroGen = 0;
        ${effectsVar}.push(() => {
          const __g = ++__outroGen;
          const __leaving = __nodes;
          const __leavingCleanups = __blockCleanups;
          __nodes = [];
          __blockEffects = [];
          __blockCleanups = [];
          const __enter = () => {
            if (__g !== __outroGen) return;
            const __frag = document.createDocumentFragment();
            {
              const __effects = __blockEffects;
              const __cleanups = __blockCleanups;
              const __list = ((${t.list}) || []);
              if (__list.length) {
                __list.forEach((${t.item}, ${idx}) => {
                  ${emitClientNodes(t.body, hash, '__frag', '__effects', inSvg)}
                });
              }${elseBranch}
            }
            let __insertBefore = ${id}.nextSibling;
            while (__frag.firstChild) {
              __nodes.push(__frag.firstChild);
              ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
            }
            for (const fn of __blockEffects) fn();
          };
          for (const __c of __leavingCleanups) { try { __c(); } catch {} }
          __runOutro(__leaving, __enter);
        });
      }`)
    } else if (t.type === 'key') {
      lines.push(`{
        const ${id} = document.createComment('key');
        ${parent}.appendChild(${id});
        let __nodes = [];
        let __blockEffects = [];
        let __blockCleanups = [];
        let __prevKey = Symbol('avedon-key');
        ${effectsVar}.push(() => {
          const __k = (${t.expr});
          if (Object.is(__k, __prevKey)) return;
          __prevKey = __k;
          for (const __c of __blockCleanups) { try { __c(); } catch {} }
          for (const n of __nodes) n.remove();
          __nodes = [];
          __blockEffects = [];
          __blockCleanups = [];
          const __frag = document.createDocumentFragment();
          {
            const __effects = __blockEffects;
            const __cleanups = __blockCleanups;
            ${emitClientNodes(t.body, hash, '__frag', '__effects', inSvg)}
          }
          let __insertBefore = ${id}.nextSibling;
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
          }
          for (const fn of __blockEffects) fn();
        });
      }`)
    } else if (t.type === 'await') {
      const pendingBlock = t.pending?.length
        ? `{
          const __frag = document.createDocumentFragment();
          {
            const __effects = __blockEffects;
            const __cleanups = __blockCleanups;
            ${emitClientNodes(t.pending, hash, '__frag', '__effects', inSvg)}
          }
          let __insertBefore = ${id}.nextSibling;
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
          }
          for (const fn of __blockEffects) fn();
        }`
        : ''
      lines.push(`{
        const ${id} = document.createComment('await');
        ${parent}.appendChild(${id});
        let __nodes = [];
        let __blockEffects = [];
        let __blockCleanups = [];
        ${pendingBlock}
        Promise.resolve(${t.promise}).then((${t.thenName}) => {
          for (const __c of __blockCleanups) { try { __c(); } catch {} }
          for (const n of __nodes) n.remove();
          __nodes = [];
          __blockEffects = [];
          __blockCleanups = [];
          const __frag = document.createDocumentFragment();
          {
            const __effects = __blockEffects;
            const __cleanups = __blockCleanups;
            ${emitClientNodes(t.thenBody, hash, '__frag', '__effects', inSvg)}
          }
          let __insertBefore = ${id}.nextSibling;
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
          }
          for (const fn of __blockEffects) fn();
        }${t.catchBody ? `, (${t.catchName ?? 'error'}) => {
          for (const __c of __blockCleanups) { try { __c(); } catch {} }
          for (const n of __nodes) n.remove();
          __nodes = [];
          __blockEffects = [];
          __blockCleanups = [];
          const __frag = document.createDocumentFragment();
          {
            const __effects = __blockEffects;
            const __cleanups = __blockCleanups;
            ${emitClientNodes(t.catchBody!, hash, '__frag', '__effects', inSvg)}
          }
          let __insertBefore = ${id}.nextSibling;
          while (__frag.firstChild) {
            __nodes.push(__frag.firstChild);
            ${id}.parentNode.insertBefore(__frag.firstChild, __insertBefore);
          }
          for (const fn of __blockEffects) fn();
        }` : ''});
      }`)
    } else if (t.type === 'component') {
      const childrenVar = `${id}_children`
      const slotsVar = `${id}_slots`
      const instVar = `${id}_inst`
      const { defaultChildren, named } = partitionSlotChildren(t.children)
      const hasChildren = !t.selfClosing && defaultChildren.length > 0
      const hasNamed = named.size > 0
      const sub: string[] = []
      if (hasChildren) {
        sub.push(`const ${childrenVar} = document.createDocumentFragment();`)
        sub.push(emitClientNodes(defaultChildren, hash, childrenVar, effectsVar, inSvg))
      }
      if (hasNamed) {
        sub.push(`const ${slotsVar} = {};`)
        let si = 0
        for (const [name, tokens] of named) {
          const frag = `${slotsVar}_f${si++}`
          sub.push(`const ${frag} = document.createDocumentFragment();`)
          sub.push(emitClientNodes(tokens, hash, frag, effectsVar, inSvg))
          sub.push(`${slotsVar}[${jsLiteral(name)}] = ${frag};`)
        }
      }
      const hasSpread = t.attrs.some((a) => a.kind === 'spread')
      if (!hasSpread) {
        const staticEntries: string[] = []
        const dynamicEntries: string[] = []
        for (const a of t.attrs) {
          if (a.kind === 'event') {
            const { propKey, modifiers } = parseEventDirective(a.name)
            const prelude = emitEventModifierPrelude(modifiers)
            const call =
              a.value != null
                ? `const __h = (${a.value}); const __r = typeof __h === 'function' ? __h(...__a) : undefined; __invalidate(); return __r;`
                : `__invalidate();`
            staticEntries.push(
              `${jsLiteral(propKey)}: (...__a) => { const event = __a[0]; ${prelude} ${call} }`,
            )
          } else if (a.kind === 'expr') {
            dynamicEntries.push(`${jsLiteral(a.name)}: (${a.value})`)
          } else if (a.value == null) {
            staticEntries.push(`${jsLiteral(a.name)}: true`)
          } else {
            staticEntries.push(`${jsLiteral(a.name)}: ${jsLiteral(a.value)}`)
          }
        }
        if (hasChildren) staticEntries.push(`children: ${childrenVar}`)
        if (hasNamed) staticEntries.push(`slots: ${slotsVar}`)
        const initProps = `{ ${[...staticEntries, ...dynamicEntries].join(', ')} }`
        sub.push(`const ${instVar} = ${t.name}.mount(${parent}, ${initProps});`)
        if (dynamicEntries.length > 0) {
          sub.push(
            `${effectsVar}.push(() => { ${instVar}.update({ ${dynamicEntries.join(', ')} }); });`,
          )
        }
      } else {
        const initChunks: string[] = []
        const updateChunks: string[] = []
        let pending: string[] = []
        let pendingDynamic: string[] = []
        const flushPending = (alsoUpdate: boolean) => {
          if (pending.length) {
            initChunks.push(`{ ${pending.join(', ')} }`)
            pending = []
          }
          if (alsoUpdate && pendingDynamic.length) {
            updateChunks.push(`{ ${pendingDynamic.join(', ')} }`)
            pendingDynamic = []
          }
        }
        for (const a of t.attrs) {
          if (a.kind === 'spread') {
            flushPending(true)
            const sp = `((${a.value}) || {})`
            initChunks.push(sp)
            updateChunks.push(sp)
            continue
          }
          if (a.kind === 'event') {
            const { propKey, modifiers } = parseEventDirective(a.name)
            const prelude = emitEventModifierPrelude(modifiers)
            const call =
              a.value != null
                ? `const __h = (${a.value}); const __r = typeof __h === 'function' ? __h(...__a) : undefined; __invalidate(); return __r;`
                : `__invalidate();`
            pending.push(
              `${jsLiteral(propKey)}: (...__a) => { const event = __a[0]; ${prelude} ${call} }`,
            )
          } else if (a.kind === 'expr') {
            const entry = `${jsLiteral(a.name)}: (${a.value})`
            pending.push(entry)
            pendingDynamic.push(entry)
          } else if (a.value == null) {
            pending.push(`${jsLiteral(a.name)}: true`)
          } else {
            pending.push(`${jsLiteral(a.name)}: ${jsLiteral(a.value)}`)
          }
        }
        flushPending(true)
        if (hasChildren) initChunks.push(`{ children: ${childrenVar} }`)
        if (hasNamed) initChunks.push(`{ slots: ${slotsVar} }`)
        sub.push(
          `const ${instVar} = ${t.name}.mount(${parent}, Object.assign({}, ${initChunks.join(', ')}));`,
        )
        if (updateChunks.length > 0) {
          sub.push(
            `${effectsVar}.push(() => { ${instVar}.update(Object.assign({}, ${updateChunks.join(', ')})); });`,
          )
        }
      }
      sub.push(`__cleanups.push(() => { ${instVar}.destroy(); });`)
      lines.push(`{ ${sub.join('\n')} }`)
    } else if (t.type === 'element') {
      lines.push(emitClientElement(t, hash, parent, id, effectsVar, inSvg))
    }
  }
  return lines.join('\n')
}

function emitClientElement(
  el: Token & { type: 'element' },
  hash: string,
  parent: string,
  id: string,
  effectsVar = '__effects',
  inSvg = false,
): string {
  const { classAttrs, classDirs, rest: afterClass } = partitionClassAttrs(el.attrs)
  const { styleAttrs, styleDirs, rest } = partitionStyleAttrs(afterClass)
  const svg = shouldCreateSvg(el.tag, inSvg)
  const lines = [
    `const ${id} = ${emitCreateElement(el.tag, inSvg)};`,
    `${id}.setAttribute(${jsLiteral(hash)}, '');`,
  ]
  if (classDirs.length) {
    const expr = classNameExpr(classAttrs, classDirs)
    // SVG `className` is SVGAnimatedString — set the attribute instead.
    if (svg) {
      lines.push(`${effectsVar}.push(() => { ${id}.setAttribute('class', ${expr}); });`)
    } else {
      lines.push(`${effectsVar}.push(() => { ${id}.className = ${expr}; });`)
    }
  } else {
    for (const a of classAttrs) {
      if (a.kind === 'expr') {
        lines.push(
          `${effectsVar}.push(() => { ${id}.setAttribute('class', (${a.value}) ?? ''); });`,
        )
      } else if (a.value == null) {
        lines.push(`${id}.setAttribute('class', '');`)
      } else {
        lines.push(`${id}.setAttribute('class', ${jsLiteral(a.value)});`)
      }
    }
  }
  if (styleDirs.length) {
    const expr = styleCssTextExpr(styleAttrs, styleDirs)
    lines.push(`${effectsVar}.push(() => { ${id}.style.cssText = ${expr}; });`)
  } else {
    for (const a of styleAttrs) {
      if (a.kind === 'expr') {
        lines.push(
          `${effectsVar}.push(() => { ${id}.setAttribute('style', (${a.value}) ?? ''); });`,
        )
      } else if (a.value == null) {
        lines.push(`${id}.setAttribute('style', '');`)
      } else {
        lines.push(`${id}.setAttribute('style', ${jsLiteral(a.value)});`)
      }
    }
  }
  for (const a of rest) {
    if (a.kind === 'event') {
      const { event, modifiers } = parseEventDirective(a.name)
      const prelude = emitEventModifierPrelude(modifiers)
      const opts = emitEventListenerOptions(modifiers)
      const handler =
        a.value != null
          ? `const __handler = (${a.value}); if (typeof __handler === 'function') __handler.call(this, event);`
          : ''
      lines.push(
        `${id}.addEventListener(${jsLiteral(event)}, function(event){ ${prelude} ${handler} __invalidate(); }${opts});`,
      )
    } else if (a.kind === 'spread') {
      lines.push(emitClientSpread(a, id, effectsVar))
    } else if (a.kind === 'use') {
      lines.push(emitClientUseAction(a, id, effectsVar))
    } else if (a.kind === 'transition') {
      lines.push(emitClientTransition(a, id))
    } else if (a.kind === 'bind' && a.name === 'bind:value') {
      if (isNumericInput(el.attrs)) {
        lines.push(
          `${effectsVar}.push(() => { ${id}.value = (${a.value}) == null || Number.isNaN(${a.value}) ? '' : String(${a.value}); });`,
        )
        lines.push(
          `${id}.addEventListener('input', () => { const __n = ${id}.valueAsNumber; ${a.value} = Number.isNaN(__n) ? undefined : __n; __invalidate(); });`,
        )
      } else if (el.tag.toLowerCase() === 'select' && isStaticMultiple(el.attrs)) {
        lines.push(`${effectsVar}.push(() => {
          const __vals = Array.isArray(${a.value}) ? ${a.value} : [];
          for (const __opt of Array.from(${id}.options)) {
            __opt.selected = __vals.some((__v) => Object.is(__v, __opt.value));
          }
        });`)
        lines.push(
          `${id}.addEventListener(${jsLiteral('change')}, () => { ${a.value} = Array.from(${id}.selectedOptions).map((__o) => __o.value); __invalidate(); });`,
        )
      } else {
        lines.push(`${effectsVar}.push(() => { ${id}.value = ${a.value} ?? ''; });`)
        const ev = el.tag.toLowerCase() === 'select' ? 'change' : 'input'
        lines.push(
          `${id}.addEventListener(${jsLiteral(ev)}, () => { ${a.value} = ${id}.value; __invalidate(); });`,
        )
      }
    } else if (a.kind === 'bind' && a.name === 'bind:checked') {
      lines.push(`${effectsVar}.push(() => { ${id}.checked = !!(${a.value}); });`)
      lines.push(
        `${id}.addEventListener('change', () => { ${a.value} = ${id}.checked; __invalidate(); });`,
      )
    } else if (a.kind === 'bind' && a.name === 'bind:group') {
      lines.push(emitClientBindGroup(a.value!, id, el.attrs, effectsVar))
    } else if (a.kind === 'bind' && a.name === 'bind:this') {
      lines.push(`${a.value} = ${id};`)
      lines.push(`__cleanups.push(() => { ${a.value} = null; });`)
    } else if (a.kind === 'bind' && a.name === 'bind:files') {
      lines.push(
        `${id}.addEventListener('change', () => { ${a.value} = ${id}.files; __invalidate(); });`,
      )
    } else if (
      a.kind === 'bind' &&
      (a.name === 'bind:clientWidth' ||
        a.name === 'bind:clientHeight' ||
        a.name === 'bind:offsetWidth' ||
        a.name === 'bind:offsetHeight')
    ) {
      lines.push(emitClientDimensionBind(a, id))
    } else if (a.kind === 'bind' && (a.name === 'bind:scrollTop' || a.name === 'bind:scrollLeft')) {
      lines.push(emitClientScrollBind(a, id, effectsVar))
    } else if (a.kind === 'bind' && (a.name === 'bind:selectionStart' || a.name === 'bind:selectionEnd')) {
      lines.push(emitClientSelectionBind(a, id, effectsVar))
    } else if (a.kind === 'bind' && a.name === 'bind:indeterminate') {
      lines.push(
        `${effectsVar}.push(() => { ${id}.indeterminate = !!(${a.value}); });`,
      )
    } else if (a.kind === 'bind' && a.name === 'bind:open') {
      lines.push(`${effectsVar}.push(() => { ${id}.open = !!(${a.value}); });`)
      lines.push(
        `${id}.addEventListener('toggle', () => { ${a.value} = ${id}.open; __invalidate(); });`,
      )
    } else if (a.kind === 'bind' && a.name === 'bind:muted') {
      lines.push(`${effectsVar}.push(() => { ${id}.muted = !!(${a.value}); });`)
      lines.push(
        `${id}.addEventListener('volumechange', () => { ${a.value} = ${id}.muted; __invalidate(); });`,
      )
    } else if (a.kind === 'bind' && a.name === 'bind:paused') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __wantPause = !!(${a.value});
          if (__wantPause !== ${id}.paused) {
            if (__wantPause) ${id}.pause();
            else { const __p = ${id}.play(); if (__p && typeof __p.catch === 'function') __p.catch(() => {}); }
          }
        });
        ${id}.addEventListener('play', () => { ${a.value} = false; __invalidate(); });
        ${id}.addEventListener('pause', () => { ${a.value} = true; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:volume') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __v = Number(${a.value});
          if (!Number.isNaN(__v) && ${id}.volume !== __v) ${id}.volume = Math.min(1, Math.max(0, __v));
        });
        ${id}.addEventListener('volumechange', () => { ${a.value} = ${id}.volume; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:currentTime') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __t = Number(${a.value});
          if (!Number.isNaN(__t) && Math.abs(${id}.currentTime - __t) > 0.25) ${id}.currentTime = __t;
        });
        ${id}.addEventListener('timeupdate', () => { ${a.value} = ${id}.currentTime; __invalidate(); });
        ${id}.addEventListener('seeked', () => { ${a.value} = ${id}.currentTime; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:playbackRate') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __r = Number(${a.value});
          if (!Number.isNaN(__r) && ${id}.playbackRate !== __r) ${id}.playbackRate = __r;
        });
        ${id}.addEventListener('ratechange', () => { ${a.value} = ${id}.playbackRate; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:duration') {
      lines.push(`{
        const __setDur = () => { ${a.value} = ${id}.duration; __invalidate(); };
        __setDur();
        ${id}.addEventListener('durationchange', __setDur);
        ${id}.addEventListener('loadedmetadata', __setDur);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:ended') {
      lines.push(`{
        const __setEnded = () => { ${a.value} = !!${id}.ended; __invalidate(); };
        __setEnded();
        ${id}.addEventListener('ended', () => { ${a.value} = true; __invalidate(); });
        ${id}.addEventListener('play', __setEnded);
        ${id}.addEventListener('seeked', __setEnded);
        ${id}.addEventListener('timeupdate', __setEnded);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:seeking') {
      lines.push(`{
        ${a.value} = !!${id}.seeking; __invalidate();
        ${id}.addEventListener('seeking', () => { ${a.value} = true; __invalidate(); });
        ${id}.addEventListener('seeked', () => { ${a.value} = false; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:played') {
      lines.push(`{
        const __setPlayed = () => {
          const __p = ${id}.played;
          const __v = __p.length ? __p.end(__p.length - 1) : 0;
          ${a.value} = Number.isFinite(__v) ? __v : 0;
          __invalidate();
        };
        __setPlayed();
        ${id}.addEventListener('timeupdate', __setPlayed);
        ${id}.addEventListener('play', __setPlayed);
        ${id}.addEventListener('seeked', __setPlayed);
        ${id}.addEventListener('progress', __setPlayed);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:buffered') {
      lines.push(`{
        const __setBuffered = () => {
          const __b = ${id}.buffered;
          const __v = __b.length ? __b.end(__b.length - 1) : 0;
          ${a.value} = Number.isFinite(__v) ? __v : 0;
          __invalidate();
        };
        __setBuffered();
        ${id}.addEventListener('progress', __setBuffered);
        ${id}.addEventListener('loadedmetadata', __setBuffered);
        ${id}.addEventListener('timeupdate', __setBuffered);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:seekable') {
      lines.push(`{
        const __setSeekable = () => {
          const __s = ${id}.seekable;
          const __v = __s.length ? __s.end(__s.length - 1) : 0;
          ${a.value} = Number.isFinite(__v) ? __v : 0;
          __invalidate();
        };
        __setSeekable();
        ${id}.addEventListener('progress', __setSeekable);
        ${id}.addEventListener('loadedmetadata', __setSeekable);
        ${id}.addEventListener('durationchange', __setSeekable);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:readyState') {
      lines.push(`{
        const __setReady = () => { ${a.value} = ${id}.readyState; __invalidate(); };
        __setReady();
        ${id}.addEventListener('loadstart', __setReady);
        ${id}.addEventListener('loadedmetadata', __setReady);
        ${id}.addEventListener('loadeddata', __setReady);
        ${id}.addEventListener('canplay', __setReady);
        ${id}.addEventListener('canplaythrough', __setReady);
        ${id}.addEventListener('emptied', __setReady);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:networkState') {
      lines.push(`{
        const __setNet = () => { ${a.value} = ${id}.networkState; __invalidate(); };
        __setNet();
        ${id}.addEventListener('loadstart', __setNet);
        ${id}.addEventListener('progress', __setNet);
        ${id}.addEventListener('suspend', __setNet);
        ${id}.addEventListener('abort', __setNet);
        ${id}.addEventListener('error', __setNet);
        ${id}.addEventListener('emptied', __setNet);
        ${id}.addEventListener('stalled', __setNet);
      }`)
    } else if (a.kind === 'bind' && (a.name === 'bind:videoWidth' || a.name === 'bind:videoHeight')) {
      const prop = a.name === 'bind:videoWidth' ? 'videoWidth' : 'videoHeight'
      lines.push(`{
        const __setDim = () => { ${a.value} = ${id}.${prop}; __invalidate(); };
        __setDim();
        ${id}.addEventListener('loadedmetadata', __setDim);
        ${id}.addEventListener('resize', __setDim);
        ${id}.addEventListener('emptied', __setDim);
      }`)
    } else if (a.kind === 'bind' && (a.name === 'bind:naturalWidth' || a.name === 'bind:naturalHeight')) {
      const prop = a.name === 'bind:naturalWidth' ? 'naturalWidth' : 'naturalHeight'
      lines.push(`{
        const __setNat = () => { ${a.value} = ${id}.${prop}; __invalidate(); };
        __setNat();
        ${id}.addEventListener('load', __setNat);
        ${id}.addEventListener('error', __setNat);
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:textContent') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __t = (${a.value}) ?? '';
          if (${id}.textContent !== __t) ${id}.textContent = __t;
        });
        ${id}.addEventListener('input', () => { ${a.value} = ${id}.textContent; __invalidate(); });
      }`)
    } else if (a.kind === 'bind' && a.name === 'bind:innerText') {
      lines.push(`{
        ${effectsVar}.push(() => {
          const __t = (${a.value}) ?? '';
          if (${id}.innerText !== __t) ${id}.innerText = __t;
        });
        ${id}.addEventListener('input', () => { ${a.value} = ${id}.innerText; __invalidate(); });
      }`)
    } else if (/^on[a-z]/i.test(a.name)) {
      // Ignore HTML event attributes; use on:click instead.
      continue
    } else if (a.kind === 'expr') {
      if (isBooleanAttr(a.name)) {
        const prop = a.name.toLowerCase()
        // Prefer IDL boolean properties when present (disabled, hidden, …).
        lines.push(
          `${effectsVar}.push(() => { if ('${prop}' in ${id}) ${id}.${prop} = !!(${a.value}); else if (${a.value}) ${id}.setAttribute(${jsLiteral(a.name)}, ''); else ${id}.removeAttribute(${jsLiteral(a.name)}); });`,
        )
      } else {
        lines.push(
          `${effectsVar}.push(() => { ${id}.setAttribute(${jsLiteral(a.name)}, (${a.value}) ?? ''); });`,
        )
      }
    } else if (a.value == null) {
      lines.push(`${id}.setAttribute(${jsLiteral(a.name)}, '');`)
    } else {
      lines.push(`${id}.setAttribute(${jsLiteral(a.name)}, ${jsLiteral(a.value)});`)
    }
  }
  if (!el.selfClosing && !VOID.has(el.tag.toLowerCase())) {
    lines.push(
      emitClientNodes(el.children, hash, id, effectsVar, childSvgContext(el.tag, inSvg)),
    )
  }
  lines.push(`${parent}.appendChild(${id});`)
  return `{ ${lines.join('\n')} }`
}

function emitClientUseAction(a: Attr, id: string, effectsVar: string): string {
  const action = a.name.slice('use:'.length)
  const hasParam = a.value != null
  return `{
    let __use = null;
    let __useParam = Symbol('avedon-use');
    ${effectsVar}.push(() => {
      ${hasParam ? `const __p = (${a.value});` : 'const __p = undefined;'}
      if (__use != null && Object.is(__p, __useParam)) return;
      if (__use != null && typeof __use.update === 'function') {
        __useParam = __p;
        __use.update(__p);
        return;
      }
      if (typeof __use === 'function') __use();
      else if (__use && typeof __use.destroy === 'function') __use.destroy();
      __useParam = __p;
      __use = ${hasParam ? `${action}(${id}, __p)` : `${action}(${id})`};
    });
    __cleanups.push(() => {
      if (typeof __use === 'function') __use();
      else if (__use && typeof __use.destroy === 'function') __use.destroy();
      __use = null;
    });
  }`
}

/** Client-only dimension bind via ResizeObserver (`clientWidth`, …). */
function emitClientDimensionBind(a: Attr, id: string): string {
  const prop = a.name.slice('bind:'.length)
  return `{
    const __setDim = () => { ${a.value} = ${id}.${prop}; __invalidate(); };
    __setDim();
    if (typeof ResizeObserver !== 'undefined') {
      const __ro = new ResizeObserver(__setDim);
      __ro.observe(${id});
      __cleanups.push(() => { __ro.disconnect(); });
    }
  }`
}

/** Two-way `bind:scrollTop` / `bind:scrollLeft`. */
function emitClientScrollBind(a: Attr, id: string, effectsVar: string): string {
  const prop = a.name.slice('bind:'.length)
  return `{
    ${effectsVar}.push(() => {
      const __v = Number(${a.value}) || 0;
      if (${id}.${prop} !== __v) ${id}.${prop} = __v;
    });
    ${id}.addEventListener('scroll', () => { ${a.value} = ${id}.${prop}; __invalidate(); }, { passive: true });
  }`
}

/** Two-way `bind:selectionStart` / `bind:selectionEnd` on text inputs / textareas. */
function emitClientSelectionBind(a: Attr, id: string, effectsVar: string): string {
  const prop = a.name.slice('bind:'.length)
  return `{
    ${effectsVar}.push(() => {
      const __v = Number(${a.value});
      if (Number.isNaN(__v)) return;
      try {
        if (${id}.${prop} !== __v) ${id}.${prop} = __v;
      } catch (_) {}
    });
    const __syncSel = () => {
      try {
        const __n = ${id}.${prop};
        if (typeof __n === 'number' && ${a.value} !== __n) {
          ${a.value} = __n;
          __invalidate();
        }
      } catch (_) {}
    };
    ${id}.addEventListener('select', __syncSel);
    ${id}.addEventListener('keyup', __syncSel);
    ${id}.addEventListener('click', __syncSel);
    ${id}.addEventListener('input', __syncSel);
  }`
}

/** Parse `transition:fade` / `in:fly` / `out:blur` … */
function parseTransitionDirective(attrName: string): {
  mode: 'both' | 'in' | 'out'
  type:
    | 'fade'
    | 'fly'
    | 'slide'
    | 'slideX'
    | 'scale'
    | 'blur'
    | 'draw'
    | 'spin'
    | 'pop'
    | 'bounce'
    | 'drop'
    | 'shake'
    | 'flip'
    | 'pulse'
    | 'wipe'
    | 'skew'
    | 'roll'
    | 'zoom'
} {
  const colon = attrName.indexOf(':')
  const prefix = attrName.slice(0, colon)
  const type = attrName.slice(colon + 1)
  if (prefix !== 'transition' && prefix !== 'in' && prefix !== 'out') {
    throw new Error(`Invalid transition directive "${attrName}"`)
  }
  if (
    type !== 'fade' &&
    type !== 'fly' &&
    type !== 'slide' &&
    type !== 'slideX' &&
    type !== 'scale' &&
    type !== 'blur' &&
    type !== 'draw' &&
    type !== 'spin' &&
    type !== 'pop' &&
    type !== 'bounce' &&
    type !== 'drop' &&
    type !== 'shake' &&
    type !== 'flip' &&
    type !== 'pulse' &&
    type !== 'wipe' &&
    type !== 'skew' &&
    type !== 'roll' &&
    type !== 'zoom'
  ) {
    throw new Error(
      `Unsupported transition "${attrName}" — only fade, fly, slide, slideX, scale, blur, draw, spin, pop, bounce, drop, shake, flip, pulse, wipe, skew, roll, and zoom are supported (transition:/in:/out:)`,
    )
  }
  const mode = prefix === 'transition' ? 'both' : (prefix as 'in' | 'out')
  return { mode, type }
}

/** Client-only `transition:` / `in:` / `out:` — fade, fly, slide, slideX, scale, blur, draw, spin, pop, bounce, drop, shake, flip, pulse, wipe, skew, roll, zoom. */
function emitClientTransition(a: Attr, id: string): string {
  const opts = a.value != null ? `(${a.value})` : 'null'
  const { mode, type } = parseTransitionDirective(a.name)
  const doIn = mode === 'both' || mode === 'in'
  const doOut = mode === 'both' || mode === 'out'

  if (type === 'fly') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'translate(' + __x + 'px,' + __y + 'px)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'translate(0,0)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'translate(' + __x + 'px,' + __y + 'px)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __x = (__topt && __topt.x != null) ? Number(__topt.x) : 0;
      const __y = (__topt && __topt.y != null) ? Number(__topt.y) : 8;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'slide') {
    const intro = doIn
      ? `${id}.style.overflow = 'hidden';
    ${id}.style.height = '0px';
    ${id}.style.opacity = '0';
    requestAnimationFrame(() => {
      const __h = ${id}.scrollHeight;
      ${id}.style.transition = 'height ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.height = __h + 'px';
      ${id}.style.opacity = '1';
      const __clear = () => {
        ${id}.style.height = '';
        ${id}.style.overflow = '';
        ${id}.style.transition = '';
      };
      ${id}.addEventListener('transitionend', __clear, { once: true });
      setTimeout(__clear, __dur + __delay + 50);
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.overflow = 'hidden';
      ${id}.style.height = ${id}.scrollHeight + 'px';
      ${id}.style.opacity = '1';
      requestAnimationFrame(() => {
        ${id}.style.transition = 'height ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
        ${id}.style.height = '0px';
        ${id}.style.opacity = '0';
      });
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      ${intro}
      ${outro}
    }`
  }

  if (type === 'slideX') {
    const intro = doIn
      ? `${id}.style.overflow = 'hidden';
    ${id}.style.width = '0px';
    ${id}.style.opacity = '0';
    requestAnimationFrame(() => {
      const __w = ${id}.scrollWidth;
      ${id}.style.transition = 'width ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.width = __w + 'px';
      ${id}.style.opacity = '1';
      const __clear = () => {
        ${id}.style.width = '';
        ${id}.style.overflow = '';
        ${id}.style.transition = '';
      };
      ${id}.addEventListener('transitionend', __clear, { once: true });
      setTimeout(__clear, __dur + __delay + 50);
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.overflow = 'hidden';
      ${id}.style.width = ${id}.scrollWidth + 'px';
      ${id}.style.opacity = '1';
      requestAnimationFrame(() => {
        ${id}.style.transition = 'width ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
        ${id}.style.width = '0px';
        ${id}.style.opacity = '0';
      });
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      ${intro}
      ${outro}
    }`
  }

  if (type === 'scale') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ')';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ')';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 0;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'spin') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'rotate(' + __deg + 'deg)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'rotate(0deg)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'rotate(' + __deg + 'deg)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __deg = (__topt && __topt.degrees != null) ? Number(__topt.degrees) : 90;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'pop') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ') translateY(' + __y + 'px)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1) translateY(0px)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ') translateY(' + __y + 'px)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.34, 1.56, 0.64, 1)';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 0.8;
      const __y = (__topt && __topt.y != null) ? Number(__topt.y) : -8;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'bounce') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ')';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ')';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 280);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 0.3;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'drop') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ') translateY(' + __y + 'px)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1) translateY(0px)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ') translateY(' + __y + 'px)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 240);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.22, 1, 0.36, 1)';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 0.9;
      const __y = (__topt && __topt.y != null) ? Number(__topt.y) : -24;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'shake') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'translateX(' + __x + 'px)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'translateX(0px)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'translateX(' + __x + 'px)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 220);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.36, 0.07, 0.19, 0.97)';
      const __x = (__topt && __topt.x != null) ? Number(__topt.x) : 12;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'flip') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'perspective(' + __persp + 'px) rotateY(' + __deg + 'deg)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'perspective(' + __persp + 'px) rotateY(0deg)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'perspective(' + __persp + 'px) rotateY(' + __deg + 'deg)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 280);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.22, 1, 0.36, 1)';
      const __deg = (__topt && __topt.degrees != null) ? Number(__topt.degrees) : 90;
      const __persp = (__topt && __topt.perspective != null) ? Number(__topt.perspective) : 600;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'pulse') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ')';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ')';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 260);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.34, 1.56, 0.64, 1)';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 1.2;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'wipe') {
    const intro = doIn
      ? `${id}.style.clipPath = __hidden;
    requestAnimationFrame(() => {
      ${id}.style.transition = 'clip-path ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.clipPath = 'inset(0 0 0 0)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'clip-path ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.clipPath = __hidden;
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 240);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __axis = (__topt && __topt.axis != null) ? String(__topt.axis) : 'left';
      const __hidden = __axis === 'right' ? 'inset(0 0 0 100%)'
        : __axis === 'up' ? 'inset(100% 0 0 0)'
        : __axis === 'down' ? 'inset(0 0 100% 0)'
        : 'inset(0 100% 0 0)';
      ${intro}
      ${outro}
    }`
  }

  if (type === 'skew') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'skewX(' + __x + 'deg) skewY(' + __y + 'deg)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'skewX(0deg) skewY(0deg)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'skewX(' + __x + 'deg) skewY(' + __y + 'deg)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 220);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __x = (__topt && __topt.x != null) ? Number(__topt.x) : 20;
      const __y = (__topt && __topt.y != null) ? Number(__topt.y) : 0;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'roll') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'perspective(' + __persp + 'px) rotateX(' + __deg + 'deg)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'perspective(' + __persp + 'px) rotateX(0deg)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'perspective(' + __persp + 'px) rotateX(' + __deg + 'deg)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 280);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.22, 1, 0.36, 1)';
      const __deg = (__topt && __topt.degrees != null) ? Number(__topt.degrees) : 90;
      const __persp = (__topt && __topt.perspective != null) ? Number(__topt.perspective) : 600;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'zoom') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.transform = 'scale(' + __start + ')';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.transform = 'scale(1)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, transform ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.transform = 'scale(' + __start + ')';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 240);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'cubic-bezier(0.16, 1, 0.3, 1)';
      const __start = (__topt && __topt.start != null) ? Number(__topt.start) : 0.5;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'blur') {
    const intro = doIn
      ? `${id}.style.opacity = '0';
    ${id}.style.filter = 'blur(' + __amount + 'px)';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, filter ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
      ${id}.style.filter = 'blur(0px)';
    });`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms, filter ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      ${id}.style.filter = 'blur(' + __amount + 'px)';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      const __amount = (__topt && __topt.amount != null) ? Number(__topt.amount) : 5;
      ${intro}
      ${outro}
    }`
  }

  if (type === 'draw') {
    const intro = doIn
      ? `if (typeof ${id}.getTotalLength === 'function') {
      const __len = ${id}.getTotalLength();
      ${id}.style.strokeDasharray = String(__len);
      ${id}.style.strokeDashoffset = String(__len);
      requestAnimationFrame(() => {
        ${id}.style.transition = 'stroke-dashoffset ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
        ${id}.style.strokeDashoffset = '0';
      });
    }`
      : ''
    const outro = doOut
      ? `${id}.__avedonOutro = (done) => {
      if (typeof ${id}.getTotalLength !== 'function') { done(); return; }
      const __len = ${id}.getTotalLength();
      ${id}.style.strokeDasharray = String(__len);
      ${id}.style.strokeDashoffset = '0';
      requestAnimationFrame(() => {
        ${id}.style.transition = 'stroke-dashoffset ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
        ${id}.style.strokeDashoffset = String(__len);
      });
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
      : ''
    return `{
      const __topt = ${opts};
      const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
      const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
      ${intro}
      ${outro}
    }`
  }

  const intro = doIn
    ? `${id}.style.opacity = '0';
    requestAnimationFrame(() => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '1';
    });`
    : ''
  const outro = doOut
    ? `${id}.__avedonOutro = (done) => {
      ${id}.style.transition = 'opacity ' + __dur + 'ms ' + __ease + ' ' + __delay + 'ms';
      ${id}.style.opacity = '0';
      let __finished = false;
      const __finish = () => { if (__finished) return; __finished = true; done(); };
      ${id}.addEventListener('transitionend', __finish, { once: true });
      setTimeout(__finish, __dur + __delay + 50);
    };`
    : ''
  return `{
    const __topt = ${opts};
    const __dur = __transitionMs((__topt && __topt.duration != null) ? Number(__topt.duration) : 200);
    const __delay = __transitionMs((__topt && __topt.delay != null) ? Number(__topt.delay) : 0);
      const __ease = (__topt && __topt.easing != null) ? String(__topt.easing) : 'ease';
    ${intro}
    ${outro}
  }`
}

const EVENT_MODIFIERS = new Set([
  'preventDefault',
  'stopPropagation',
  'stopImmediatePropagation',
  'once',
  'self',
  'capture',
  'passive',
  'nonpassive',
])

function parseEventDirective(attrName: string): {
  event: string
  modifiers: string[]
  propKey: string
} {
  const rest = attrName.slice('on:'.length)
  const parts = rest.split('|')
  const event = parts[0]!
  if (!event || !/^[A-Za-z_][\w-]*$/.test(event)) {
    throw new Error(`Invalid event name in "${attrName}"`)
  }
  const modifiers = parts.slice(1)
  for (const m of modifiers) {
    if (!EVENT_MODIFIERS.has(m)) {
      throw new Error(
        `Unknown event modifier "${m}" on ${attrName} — supported: ${[...EVENT_MODIFIERS].join(', ')}`,
      )
    }
  }
  if (modifiers.includes('passive') && modifiers.includes('nonpassive')) {
    throw new Error(`Cannot combine passive and nonpassive on ${attrName}`)
  }
  return { event, modifiers, propKey: 'on' + event }
}

function emitEventModifierPrelude(modifiers: string[]): string {
  const lines: string[] = []
  if (modifiers.includes('self')) {
    lines.push('if (event.target !== event.currentTarget) return;')
  }
  if (modifiers.includes('preventDefault')) {
    lines.push('event.preventDefault();')
  }
  if (modifiers.includes('stopImmediatePropagation')) {
    lines.push('event.stopImmediatePropagation();')
  } else if (modifiers.includes('stopPropagation')) {
    lines.push('event.stopPropagation();')
  }
  return lines.join(' ')
}

function emitEventListenerOptions(modifiers: string[]): string {
  const once = modifiers.includes('once')
  const capture = modifiers.includes('capture')
  const passive = modifiers.includes('passive')
  const nonpassive = modifiers.includes('nonpassive')
  if (!once && !capture && !passive && !nonpassive) return ''
  const parts: string[] = []
  if (once) parts.push('once: true')
  if (capture) parts.push('capture: true')
  if (passive) parts.push('passive: true')
  if (nonpassive) parts.push('passive: false')
  return `, { ${parts.join(', ')} }`
}
