import { compileMarkup } from './codegen.js'
import { hashStyle, parse, scopeCss } from './parse.js'

export interface CompileOptions {
  filename?: string
  generate?: 'client' | 'ssr'
}

export interface CompileResult {
  code: string
  css: string
  cssHash: string
  dts: string
  map: null
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.vex'
  const generate = options.generate ?? 'client'
  if (generate === 'ssr') return compileSsr(source, { filename })

  const parsed = parse(source)
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const { ssrExpr, clientBuild } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash)

  // Client codegen never interpolates serverScript — physical exclusion (not tree-shake).
  const code = `import { escapeHtml as __escape } from '@vexjs/runtime';
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
${clientMountBody(clientBody, clientBuild)}
  for (const fn of __effects) fn();
  return {
    destroy() { target.textContent = ''; },
    update(next = {}) {
      Object.assign(__props, next);
${assignProps(clientBody)}
      __invalidate();
    }
  };
}

/** Soft hydrate: rebuild into a fragment then replaceChildren (no empty flash). */
export function hydrate(target, __props = {}) {
  if (!target.hasChildNodes() || target.querySelector('[data-vex-csr]')) {
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
    update(next = {}) { inst.update(next); },
  };
}

export default { render, mount, hydrate, css, cssHash };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody), map: null }
}

export function compileSsr(source: string, options: { filename?: string } = {}): CompileResult {
  const filename = options.filename ?? 'Component.vex'
  const parsed = parse(source)
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const { ssrExpr } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash)

  const hasLoad = /\bexport\s+(?:async\s+)?function\s+load\b|\bexport\s+(?:const|let|var)\s+load\b/.test(
    parsed.serverScript,
  )
  const hasActions = /\bexport\s+(?:const|let|var)\s+actions\b/.test(parsed.serverScript)
  const hasApiMap = /\bexport\s+(?:const|let|var)\s+api\b/.test(parsed.serverScript)
  const apiMethods = [...parsed.serverScript.matchAll(/\bexport\s+(?:async\s+)?function\s+(api_[A-Z]+)\b/g)].map(
    (m) => m[1],
  )
  const hasApiFns = apiMethods.length > 0
  const defaultParts = ['render', 'css', 'cssHash']
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

  const code = `import { escapeHtml as __escape } from '@vexjs/runtime';
${clientImports}

${parsed.serverScript}
${apiBridge}
export function render(__props = {}) {
${ssrRenderBody(clientBody, ssrExpr)}
}

export const css = ${JSON.stringify(css)};
export const cssHash = ${JSON.stringify(cssHash)};

export default { ${[...new Set(defaultParts)].join(', ')} };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody), map: null }
}

function generateDts(filename: string, clientScript: string): string {
  const props = extractExportLets(clientScript)
  const propFields = props.map((p) => `  ${p}?: unknown`).join('\n')
  const mod = filename.replace(/\\/g, '/')
  return `declare module '*${mod}' {
  export function render(props?: Record<string, unknown>): string
  export function mount(target: Element, props?: Record<string, unknown>): { destroy(): void; update(props: Record<string, unknown>): void }
  export function hydrate(target: Element, props?: Record<string, unknown>): { destroy(): void; update(props: Record<string, unknown>): void }
  export const css: string
  export const cssHash: string
  const __default: {
    render: typeof render
    mount?: typeof mount
    hydrate?: typeof hydrate
    css: string
    cssHash: string
    load?: (event: unknown) => unknown
    actions?: Record<string, unknown>
    api?: Record<string, unknown>
  }
  export default __default
}

export interface Props {
${propFields || '  [key: string]: unknown'}
}
`
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

function clientMountBody(clientScript: string, clientBuild: string): string {
  const lines: string[] = []
  const exported = extractExportLets(clientScript)
  for (const p of exported) {
    lines.push(`  let ${p} = __props.${p};`)
  }
  const body = stripExportLets(clientScript, exported)
  if (body.trim()) lines.push(indent(body, 2))
  lines.push(indent(clientBuild, 2))
  return lines.join('\n')
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
