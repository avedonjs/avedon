import { compileMarkup } from './codegen.js'
import { inferLoadDataType } from './load-types.js'
import { hashStyle, parse, scopeCss } from './parse.js'
import ts from 'typescript'

export interface CompileOptions {
  filename?: string
  generate?: 'client' | 'ssr'
  /** Emit HMR signal bags / getHmrState (dev only; default false). */
  hmr?: boolean
}

export interface CompileResult {
  code: string
  css: string
  cssHash: string
  dts: string
  map: null
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.avedon'
  const generate = options.generate ?? 'client'
  if (generate === 'ssr') return compileSsr(source, { filename })

  const hmr = options.hmr === true
  const parsed = parse(source)
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const { ssrExpr, clientBuild } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash)

  const hmrImport = hmr
    ? `, __hmrBeginSignalBag, __hmrEndSignalBag, __hmrSnapshotSignals`
    : ''

  // Client codegen never interpolates serverScript — physical exclusion (not tree-shake).
  const code = `import { escapeHtml as __escape${hmrImport} } from '@avedon/runtime';
${clientImports}

export const css = ${JSON.stringify(css)};
export const cssHash = ${JSON.stringify(cssHash)};

export function render(__props = {}) {
${ssrRenderBody(clientBody, ssrExpr)}
}

export function mount(target, __props = {}) {
  const __effects = [];
  let __scheduled = false;
  function __invalidate() {
    if (__scheduled) return;
    __scheduled = true;
    queueMicrotask(() => {
      __scheduled = false;
      for (const fn of __effects) fn();
    });
  }
${hmr ? '  const __signalBag = __hmrBeginSignalBag();\n' : ''}${clientMountBody(clientBody, clientBuild, hmr)}${hmr ? '\n  __hmrEndSignalBag();' : ''}
  for (const fn of __effects) fn();
  return {
    destroy() { target.textContent = ''; },
    update(next = {}) {
      Object.assign(__props, next);
${assignProps(clientBody)}
      __invalidate();
    },${hmr ? `\n    getHmrState() {\n      return { data: __props.data, signals: __hmrSnapshotSignals(__signalBag) };\n    },` : ''}
  };
}

/** Soft hydrate: rebuild into a fragment then replaceChildren (no empty flash). */
export function hydrate(target, __props = {}) {
  if (!target.hasChildNodes() || target.querySelector('[data-avedon-csr]')) {
    target.textContent = '';
    return mount(target, __props);
  }
  const holder = document.createElement('div');
  const inst = mount(holder, __props);
  const frag = document.createDocumentFragment();
  while (holder.firstChild) frag.appendChild(holder.firstChild);
  target.replaceChildren(frag);
  return {
    destroy() { target.textContent = ''; },
    update(next = {}) { inst.update(next); },${hmr ? `\n    getHmrState: inst.getHmrState,` : ''}
  };
}

export default { render, mount, hydrate, css, cssHash };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody, parsed.serverScript), map: null }
}

export function compileSsr(source: string, options: { filename?: string } = {}): CompileResult {
  const filename = options.filename ?? 'Component.avedon'
  const parsed = parse(source)
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const { ssrExpr, ssrStream } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash)

  const hasLoad = /\bexport\s+(?:async\s+)?function\s+load\b|\bexport\s+(?:const|let|var)\s+load\b/.test(
    parsed.serverScript,
  )
  const hasActions = /\bexport\s+(?:const|let|var)\s+actions\b/.test(parsed.serverScript)
  const hasApiMap = /\bexport\s+(?:const|let|var)\s+api\b/.test(parsed.serverScript)
  const apiMethods = [...parsed.serverScript.matchAll(/\bexport\s+(?:async\s+)?function\s+(api_[A-Z]+)\b/g)].map(
    (m) => m[1],
  )
  const hasApiFns = apiMethods.length > 0
  const defaultParts = ['render', 'renderInto', 'renderToStream', 'css', 'cssHash']
  if (hasLoad) defaultParts.push('load')
  if (hasActions) defaultParts.push('actions')
  if (hasApiMap || hasApiFns) defaultParts.push('api')
  for (const name of apiMethods) defaultParts.push(name)

  const apiBridge =
    hasApiFns && !hasApiMap
      ? `\nconst api = {\n${apiMethods
          .map((name) => {
            const method = name.slice(4) // api_GET → GET
            return `  ${JSON.stringify(method)}: ${name},`
          })
          .join('\n')}\n};\n`
      : hasApiFns && hasApiMap
        ? `\n;(() => {\n${apiMethods
            .map((name) => {
              const method = name.slice(4)
              return `  if (typeof api === 'object' && api && !(${JSON.stringify(method)} in api)) api[${JSON.stringify(method)}] = ${name};`
            })
            .join('\n')}\n})();\n`
        : ''

  const code = `import { escapeHtml as __escape, createRenderStream } from '@avedon/runtime';
${clientImports}

${stripTypeScript(parsed.serverScript)}
${apiBridge}
export function render(__props = {}) {
${ssrRenderBody(clientBody, ssrExpr)}
}

export async function renderInto(__ctrl, __props = {}) {
${ssrStreamBody(clientBody, ssrStream)}
}

export function renderToStream(__props = {}) {
  const __ctrl = createRenderStream();
  Promise.resolve()
    .then(() => renderInto(__ctrl, __props))
    .then(() => __ctrl.waitPending())
    .then(() => __ctrl.close())
    .catch((e) => __ctrl.error(e));
  return __ctrl.stream;
}

export const css = ${JSON.stringify(css)};
export const cssHash = ${JSON.stringify(cssHash)};

export default { ${[...new Set(defaultParts)].join(', ')} };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody, parsed.serverScript), map: null }
}

function generateDts(filename: string, clientScript: string, serverScript = ''): string {
  const props = extractExportLets(clientScript)
  const dataType = inferLoadDataType(serverScript)
  const propLines: string[] = []
  for (const p of props) {
    if (p === 'data') {
      if (dataType !== undefined) propLines.push(`  data?: ${dataType}`)
      continue
    }
    propLines.push(`  ${p}?: unknown`)
  }
  if (dataType !== undefined && !props.includes('data')) {
    propLines.unshift(`  data?: ${dataType}`)
  }
  const mod = filename.replace(/\\/g, '/')
  const loadSig =
    dataType !== undefined
      ? `load?: (event: unknown) => Promise<{ data: ${dataType} } | void> | { data: ${dataType} } | void`
      : undefined
  const auxTypes = dataType ? collectAuxTypeAliases(serverScript, dataType) : ''
  return `declare module '*${mod}' {
  export function render(props?: Record<string, unknown>): string
  export function renderInto(ctrl: import('@avedon/runtime').RenderStreamController, props?: Record<string, unknown>): Promise<void>
  export function renderToStream(props?: Record<string, unknown>): ReadableStream<Uint8Array>
  export function mount(target: Element, props?: Record<string, unknown>): { destroy(): void; update(props: Record<string, unknown>): void }
  export function hydrate(target: Element, props?: Record<string, unknown>): { destroy(): void; update(props: Record<string, unknown>): void }
  export const css: string
  export const cssHash: string
  const __default: {
    render: typeof render
    renderInto?: typeof renderInto
    renderToStream?: typeof renderToStream
    mount?: typeof mount
    hydrate?: typeof hydrate
    css: string
    cssHash: string
    ${loadSig ? loadSig : 'load?: (event: unknown) => unknown'}
    actions?: Record<string, unknown>
    api?: Record<string, unknown>
  }
  export default __default
}

${auxTypes}export interface Props {
${propLines.length ? propLines.join('\n') : '  [key: string]: unknown'}
}
`
}

/** Copy `type` / `export type` aliases referenced by the data type into the .d.ts. */
function collectAuxTypeAliases(serverScript: string, dataType: string): string {
  const names = new Set(
    [...dataType.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]).filter((n) => n !== 'Promise'),
  )
  const out: string[] = []
  const seen = new Set<string>()

  function captureAlias(name: string): string | undefined {
    const re = new RegExp(`(?:export\\s+)?type\\s+${name}\\s*=\\s*`)
    const m = re.exec(serverScript)
    if (!m) return undefined
    const start = m.index + m[0].length
    const slice = serverScript.slice(start)
    // Object type `{ ... }` or simple expr until `;` / newline before next export
    if (slice.trimStart().startsWith('{')) {
      const abs = start + slice.indexOf('{')
      let depth = 0
      let i = abs
      for (; i < serverScript.length; i++) {
        if (serverScript[i] === '{') depth++
        else if (serverScript[i] === '}') {
          depth--
          if (depth === 0) {
            i++
            break
          }
        }
      }
      return serverScript.slice(abs, i).trim()
    }
    const end = slice.search(/[;\n]/)
    return (end < 0 ? slice : slice.slice(0, end)).trim().replace(/;+\s*$/, '')
  }

  for (const name of [...names]) {
    if (seen.has(name)) continue
    const body = captureAlias(name)
    if (!body) continue
    seen.add(name)
    out.push(`export type ${name} = ${body}`)
    for (const nested of body.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
      names.add(nested[1])
    }
  }
  for (const name of names) {
    if (seen.has(name)) continue
    const body = captureAlias(name)
    if (!body) continue
    seen.add(name)
    out.push(`export type ${name} = ${body}`)
  }
  return out.length ? out.join('\n') + '\n\n' : ''
}

function ssrRenderBody(clientScript: string, ssrExpr: string): string {
  const lines: string[] = []
  const exported = extractExportLets(clientScript)
  for (const p of exported) {
    lines.push(`  let ${p} = __props.${p};`)
  }
  const body = stripExportLets(clientScript, exported)
  if (body.trim()) lines.push(indent(body, 2))
  lines.push(`  return ${ssrExpr};`)
  return lines.join('\n')
}

function ssrStreamBody(clientScript: string, ssrStream: string): string {
  const lines: string[] = []
  const exported = extractExportLets(clientScript)
  for (const p of exported) {
    lines.push(`  let ${p} = __props.${p};`)
  }
  const body = stripExportLets(clientScript, exported)
  if (body.trim()) lines.push(indent(body, 2))
  lines.push(`  const __enqueue = (html) => __ctrl.enqueueHtml(html);`)
  lines.push(
    `  const __awaitBoundary = (p, t, c) => __ctrl.enqueueBoundary(p, t, c, __enqueue);`,
  )
  lines.push(`  const __pipeChildren = (ch) => __ctrl.pipeChildren(ch);`)
  if (ssrStream.trim()) lines.push(indent(ssrStream, 2))
  return lines.join('\n')
}

function clientMountBody(clientScript: string, clientBuild: string, hmr = false): string {
  const lines: string[] = []
  const exported = extractExportLets(clientScript)
  for (const p of exported) {
    lines.push(`  let ${p} = __props.${p};`)
  }
  const body = stripExportLets(clientScript, exported)
  const prepared = hmr ? injectSignalHmrKeys(body) : body
  if (prepared.trim()) lines.push(indent(prepared, 2))
  lines.push(indent(clientBuild, 2))
  return lines.join('\n')
}

/**
 * `const likes = signal(init)` → `const likes = signal(init, "likes")` so HMR can restore by name.
 * Only rewrites when the second argument is not already present.
 */
function injectSignalHmrKeys(script: string): string {
  return script.replace(
    /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*signal\s*\(([\s\S]*?)\)\s*;?/g,
    (full, kind, name, args) => {
      if (hasTopLevelComma(args)) return full
      return `${kind} ${name} = signal(${args.trim()}, ${JSON.stringify(name)});`
    },
  )
}

function hasTopLevelComma(args: string): boolean {
  let depth = 0
  for (let i = 0; i < args.length; i++) {
    const c = args[i]
    if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth--
    else if (c === ',' && depth === 0) return true
  }
  return false
}

/** Strip TypeScript syntax from server scripts embedded in SSR JS output. */
function stripTypeScript(source: string): string {
  if (!source.trim()) return source
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      strict: false,
      removeComments: false,
    },
    reportDiagnostics: false,
  }).outputText
}

function assignProps(clientScript: string): string {
  return extractExportLets(clientScript)
    .map((p) => `      if (next.${p} !== undefined) ${p} = next.${p};`)
    .join('\n')
}

function extractExportLets(script: string): string[] {
  const out: string[] = []
  const re = /export\s+let\s+(\w+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(script))) out.push(m[1])
  return out
}

/** Hoist ESM imports out of render/mount bodies. */
function splitImports(script: string): { imports: string; body: string } {
  const imports: string[] = []
  const body = script.replace(/^\s*import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, (line) => {
    imports.push(line.trim())
    return ''
  })
  return { imports: imports.join('\n'), body: body.trim() }
}

function stripExportLets(script: string, exported: string[]): string {
  let body = script
  for (const name of exported) {
    body = body.replace(new RegExp(`export\\s+let\\s+${name}\\b[^;\\n]*;?`, 'g'), '')
  }
  return body.trim()
}

function indent(code: string, n: number): string {
  const pad = ' '.repeat(n)
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

export { parse, hashStyle, scopeCss } from './parse.js'
