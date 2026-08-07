import { compileMarkup } from './codegen.js'
import { extractActionKeys, extractLoadParamsType, inferLoadDataType } from './load-types.js'
import { collectSignalNames, prepareSignalExpr } from './signal-script.js'
import { hashStyle, parse, scopeCss } from './parse.js'
import {
  CompileError,
  type CompileDiagnostic,
  sectionDiagnostic,
} from './diagnostics.js'
import ts from 'typescript'

export interface CompileOptions {
  filename?: string
  generate?: 'client' | 'ssr'
  /** Emit HMR signal bags / getHmrState (dev only; default false). */
  hmr?: boolean
  /** When true, forbid <script server> (file used as a presentational UI component). */
  asUiComponent?: boolean
}

export interface CompileResult {
  code: string
  css: string
  cssHash: string
  dts: string
  map: null
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.filename ?? 'Component.ave'
  const generate = options.generate ?? 'client'
  if (generate === 'ssr') return compileSsr(source, { filename, asUiComponent: options.asUiComponent })

  const hmr = options.hmr === true
  const parsed = parse(source)
  assertNoServerOnUiComponent(
    parsed.serverScript,
    options.asUiComponent,
    filename,
    parsed.ranges.serverScript,
  )
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const signalNames = collectSignalNames(stripTypeScript(clientBody))
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const components = extractComponentImports(clientImports)
  const { ssrExpr, clientBuild, componentsUsed } = compileMarkup(
    parsed.markup || '<!-- empty -->',
    cssHash,
    components,
    signalNames,
    parsed.markup ? parsed.ranges.markup.start : 0,
  )

  const hmrImport = hmr
    ? `, __hmrBeginSignalBag, __hmrEndSignalBag, __hmrSnapshotSignals`
    : ''

  // Client codegen never interpolates serverScript — physical exclusion (not tree-shake).
  const code = `import { escapeHtml as __escape, __lifecycleBegin, __lifecycleEnd, __lifecycleAbort, __contextBegin, __updateHooksBegin, __updateHooksEnd, __updateHooksAbort, captureFocus as __captureFocus, restoreFocus as __restoreFocus, captureFormState as __captureFormState, restoreFormState as __restoreFormState, captureScrollState as __captureScrollState, restoreScrollState as __restoreScrollState, captureOpenState as __captureOpenState, restoreOpenState as __restoreOpenState, transitionMs as __transitionMs, effect as __effect, claimPush as __claimPush, claimPop as __claimPop, claimCurrent as __claimCurrent, claimStackActive as __claimStackActive, claimStackDepth as __claimStackDepth, assertClaimExhausted as __assertClaimExhausted, claimAdvancePastSiblings as __claimAdvancePastSiblings, claimAdvanceUntilComment as __claimAdvanceUntilComment, avedonEl as __avedonEl, avedonElEnd as __avedonElEnd, avedonText as __avedonText, avedonTextEmpty as __avedonTextEmpty, avedonComment as __avedonComment, avedonClaimingInto as __avedonClaimingInto, HydrateMismatchError as __HydrateMismatchError, crossfadeSend as __crossfadeSend, crossfadeReceive as __crossfadeReceive${hmrImport} } from '@avedon/runtime';
${clientImports}

export const css = ${cssExportExpr(css, componentsUsed)};
export const cssHash = ${JSON.stringify(cssHash)};

export function render(__props = {}) {
${ssrRenderBody(clientBody, ssrExpr)}
}

export function mount(target, __props = {}) {
  const __effects = [];
  const __cleanups = [];
  const __owned = [];
  const __beforeUpdate = [];
  const __afterUpdate = [];
  __lifecycleBegin(__cleanups);
  const __contextEnd = __contextBegin();
  __cleanups.push(__contextEnd);
  __updateHooksBegin(__beforeUpdate, __afterUpdate);
  try {
  let __scheduled = false;
  let __updateReady = false;
  function __invalidate() {
    if (__scheduled) return;
    __scheduled = true;
    queueMicrotask(() => {
      __scheduled = false;
      for (const __b of __beforeUpdate) { try { __b(); } catch {} }
      for (const fn of __effects) fn();
      for (const __a of __afterUpdate) { try { __a(); } catch {} }
    });
  }
  function __runOutro(nodes, done) {
    const list = nodes || [];
    const tasks = [];
    for (const n of list) {
      if (n && n.nodeType === 1 && typeof n.__avedonOutro === 'function') {
        tasks.push(new Promise((resolve) => {
          try { n.__avedonOutro(resolve); } catch { resolve(); }
        }));
      }
    }
    const finish = () => {
      for (const n of list) { try { n.remove(); } catch {} }
      done();
    };
    if (tasks.length) Promise.all(tasks).then(finish);
    else finish();
  }
${hmr ? '  const __signalBag = __hmrBeginSignalBag();\n' : ''}${clientMountBody(clientBody, clientBuild, hmr)}${hmr ? '\n  __hmrEndSignalBag();' : ''}
  __updateHooksEnd();
  __lifecycleEnd();
  for (const fn of __effects) {
    __cleanups.push(__effect(() => {
      if (__updateReady) {
        for (const __b of __beforeUpdate) { try { __b(); } catch {} }
      }
      fn();
      if (__updateReady) {
        for (const __a of __afterUpdate) { try { __a(); } catch {} }
      }
    }));
  }
  for (const __a of __afterUpdate) { try { __a(); } catch {} }
  __updateReady = true;
  return {
    destroy() {
      for (const __c of __cleanups) { try { __c(); } catch {} }
      __cleanups.length = 0;
      for (const __n of __owned) { try { __n.remove(); } catch {} }
      __owned.length = 0;
    },
    update(next = {}) {
      for (const __k of Object.keys(next)) {
        if (next[__k] === undefined) delete __props[__k];
        else __props[__k] = next[__k];
      }
${assignProps(clientBody)}
      __invalidate();
    },${hmr ? `\n    getHmrState() {\n      return { data: __props.data, signals: __hmrSnapshotSignals(__signalBag) };\n    },` : ''}
  };
  } catch (__mountErr) {
    __updateHooksAbort();
    __lifecycleAbort();
    for (const __c of __cleanups) { try { __c(); } catch {} }
    __cleanups.length = 0;
    throw __mountErr;
  }
}

/** Claim hydrate: reuse SSR nodes; soft-remount on mismatch (prod) or throw (dev). */
export function hydrate(target, __props = {}) {
  if (!target.hasChildNodes() || target.querySelector('[data-avedon-csr]')) {
    target.textContent = '';
    return mount(target, __props);
  }
  const __dev = !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
  let __inst = null;
  const __claimBase = __claimStackDepth();
  try {
    __claimPush(target);
    __inst = mount(target, __props);
    __assertClaimExhausted(__claimCurrent());
    __claimPop();
    return __inst;
  } catch (e) {
    while (__claimStackDepth() > __claimBase) __claimPop();
    if (!(e instanceof __HydrateMismatchError) || __dev) {
      if (__inst) { try { __inst.destroy(); } catch {} }
      throw e;
    }
    const __focus = __captureFocus(target);
    const __form = __captureFormState(target);
    const __open = __captureOpenState(target);
    const __scroll = __captureScrollState(target);
    if (__inst) { try { __inst.destroy(); } catch {} }
    const holder = document.createElement('div');
    const soft = mount(holder, __props);
    const frag = document.createDocumentFragment();
    while (holder.firstChild) frag.appendChild(holder.firstChild);
    target.replaceChildren(frag);
    __restoreFormState(target, __form);
    __restoreOpenState(target, __open);
    __restoreScrollState(target, __scroll);
    __restoreFocus(target, __focus);
    return {
      destroy() {
        soft.destroy();
        target.textContent = '';
      },
      update(next = {}) { soft.update(next); },${hmr ? `\n      getHmrState: soft.getHmrState,` : ''}
    };
  }
}

export default { render, mount, hydrate, css, cssHash };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody, parsed.serverScript), map: null }
}

export function compileSsr(
  source: string,
  options: { filename?: string; asUiComponent?: boolean } = {},
): CompileResult {
  const filename = options.filename ?? 'Component.ave'
  const parsed = parse(source)
  assertNoServerOnUiComponent(
    parsed.serverScript,
    options.asUiComponent,
    filename,
    parsed.ranges.serverScript,
  )
  const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
  const cssHash = hashStyle(parsed.style, filename)
  const css = parsed.scoped ? scopeCss(parsed.style, cssHash) : parsed.style
  const components = extractComponentImports(clientImports)
  const signalNames = collectSignalNames(stripTypeScript(clientBody))
  const { ssrExpr, ssrStream, componentsUsed } = compileMarkup(
    parsed.markup || '<!-- empty -->',
    cssHash,
    components,
    signalNames,
    parsed.markup ? parsed.ranges.markup.start : 0,
  )

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

  const code = `import { escapeHtml as __escape, createRenderStream, __contextBegin } from '@avedon/runtime';
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

export const css = ${cssExportExpr(css, componentsUsed)};
export const cssHash = ${JSON.stringify(cssHash)};

export default { ${[...new Set(defaultParts)].join(', ')} };
`
  return { code, css, cssHash, dts: generateDts(filename, clientBody, parsed.serverScript), map: null }
}

function assertNoServerOnUiComponent(
  serverScript: string,
  asUiComponent: boolean | undefined,
  filename: string,
  serverRange?: { start: number; end: number } | null,
): void {
  if (asUiComponent && serverScript.trim()) {
    const message = `UI components cannot have a <script server> (${filename}). Move server logic to a route page or layout.`
    if (serverRange) {
      throw new CompileError(message, [sectionDiagnostic(message, serverRange)])
    }
    throw new Error(message)
  }
}

/** Default imports with PascalCase bindings — candidate UI components for template tags. */
function extractComponentImports(importsCode: string): Set<string> {
  const set = new Set<string>()
  const re = /import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"][^'"]+['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(importsCode))) set.add(m[1])
  return set
}

/** Parent css export; appends css of components used in the template so SSR shells stay styled. */
function cssExportExpr(css: string, componentsUsed: string[]): string {
  const base = JSON.stringify(css)
  if (componentsUsed.length === 0) return base
  const parts = componentsUsed.map((n) => `(${n}.css || '')`)
  return [base, ...parts].join(' + ')
}

function generateDts(filename: string, clientScript: string, serverScript = ''): string {
  const props = extractExportLets(clientScript)
  const dataType = inferLoadDataType(serverScript)
  const hasLoad = /\bexport\s+(?:async\s+)?function\s+load\b|\bexport\s+(?:const|let|var)\s+load\b/.test(
    serverScript,
  )
  const hasActions = /\bexport\s+(?:const|let|var)\s+actions\b/.test(serverScript)
  const paramsType = extractLoadParamsType(serverScript) ?? 'Record<string, string>'
  const loadContext = `import('@avedon/shared').LoadContext<${paramsType}>`
  const actionHandler = `import('@avedon/shared').ActionHandler<${paramsType}>`

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
  const propsBody = propLines.length ? propLines.join('\n') : '  [key: string]: unknown'
  const mod = filename.replace(/\\/g, '/')

  let loadSig: string
  if (dataType !== undefined) {
    loadSig = `load?: (event: ${loadContext}) => Promise<{ data: ${dataType} } | void> | { data: ${dataType} } | void`
  } else if (hasLoad) {
    loadSig = `load?: (event: ${loadContext}) => import('@avedon/shared').LoadResult | Promise<import('@avedon/shared').LoadResult>`
  } else {
    loadSig = `load?: (event: ${loadContext}) => import('@avedon/shared').LoadResult | Promise<import('@avedon/shared').LoadResult>`
  }

  let actionsSig: string
  if (hasActions) {
    const keys = extractActionKeys(serverScript)
    if (keys.length) {
      actionsSig = `actions?: { ${keys.map((k) => `${k}?: ${actionHandler}`).join('; ')} }`
    } else {
      actionsSig = `actions?: Record<string, ${actionHandler}>`
    }
  } else {
    actionsSig = `actions?: Record<string, ${actionHandler}>`
  }

  const auxTypes = dataType ? collectAuxTypeAliases(serverScript, dataType) : ''
  // Keep aux aliases inside the ambient module so sibling `.ave.d.ts` files stay
  // script-like (no top-level `export`) and `import './X.ave'` still resolves.
  const auxInside = auxTypes
    ? auxTypes
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => `  ${line}`)
        .join('\n') + '\n'
    : ''
  return `declare module '*${mod}' {
${auxInside}  export interface Props {
${propsBody}
  }
  export function render(props?: Props): string
  export function renderInto(ctrl: import('@avedon/runtime').RenderStreamController, props?: Props): Promise<void>
  export function renderToStream(props?: Props): ReadableStream<Uint8Array>
  export function mount(target: Element, props?: Props): { destroy(): void; update(props: Props): void }
  export function hydrate(target: Element, props?: Props): { destroy(): void; update(props: Props): void }
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
    ${loadSig}
    ${actionsSig}
    api?: Record<string, import('@avedon/shared').ApiHandler<${paramsType}>>
  }
  export default __default
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
  lines.push(`  const __contextEnd = __contextBegin();`)
  lines.push(`  try {`)
  const script = stripTypeScript(clientScript)
  const exported = extractExportLets(script)
  for (const p of exported) {
    lines.push(`    let ${p} = __props.${p};`)
  }
  const body = wireEventDispatcher(stripExportLets(script, exported))
  if (body.trim()) lines.push(indent(body, 4))
  lines.push(`    return ${ssrExpr};`)
  lines.push(`  } finally {`)
  lines.push(`    __contextEnd();`)
  lines.push(`  }`)
  return lines.join('\n')
}

function ssrStreamBody(clientScript: string, ssrStream: string): string {
  const lines: string[] = []
  lines.push(`  const __contextEnd = __contextBegin();`)
  lines.push(`  try {`)
  const script = stripTypeScript(clientScript)
  const exported = extractExportLets(script)
  for (const p of exported) {
    lines.push(`    let ${p} = __props.${p};`)
  }
  const body = wireEventDispatcher(stripExportLets(script, exported))
  if (body.trim()) lines.push(indent(body, 4))
  lines.push(`    const __enqueue = (html) => __ctrl.enqueueHtml(html);`)
  lines.push(
    `    const __awaitBoundary = (p, t, c, e, pend) => __ctrl.enqueueBoundary(p, t, c, e ?? __enqueue, pend);`,
  )
  lines.push(`    const __pipeChildren = (ch) => __ctrl.pipeChildren(ch);`)
  if (ssrStream.trim()) lines.push(indent(ssrStream, 4))
  lines.push(`  } finally {`)
  lines.push(`    __contextEnd();`)
  lines.push(`  }`)
  return lines.join('\n')
}

function clientMountBody(clientScript: string, clientBuild: string, hmr = false): string {
  const lines: string[] = []
  const script = stripTypeScript(clientScript)
  const signalNames = collectSignalNames(script)
  const exported = extractExportLets(script)
  for (const p of exported) {
    lines.push(`  let ${p} = __props.${p};`)
  }
  const body = wireEventDispatcher(stripExportLets(script, exported))
  const prepared = prepareSignalExpr(body, signalNames)
  const withHmr = hmr ? injectSignalHmrKeys(prepared) : prepared
  if (withHmr.trim()) lines.push(indent(withHmr, 2))
  lines.push(indent(clientBuild, 2))
  return lines.join('\n')
}

/** `createEventDispatcher()` → `createEventDispatcher(__props)` so handlers stay live across update(). */
function wireEventDispatcher(script: string): string {
  return script.replace(/\bcreateEventDispatcher\s*\(\s*\)/g, 'createEventDispatcher(__props)')
}

/**
 * `const likes = signal(init)` → `const likes = signal(init, "likes")` so HMR can restore by name.
 * Only rewrites when the second argument is not already present.
 * Linear scan (no nested `[\s\S]*?`) to avoid ReDoS on large client scripts.
 */
function injectSignalHmrKeys(script: string): string {
  const re = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*signal\s*\(/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(script))) {
    const startArgs = m.index + m[0].length
    let depth = 1
    let i = startArgs
    for (; i < script.length; i++) {
      const c = script[i]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0) break
    const args = script.slice(startArgs, i)
    out += script.slice(last, m.index)
    if (hasTopLevelComma(args)) {
      out += script.slice(m.index, i + 1)
    } else {
      out += `${m[1]} ${m[2]} = signal(${args.trim()}, ${JSON.stringify(m[2])})`
    }
    last = i + 1
    re.lastIndex = last
  }
  out += script.slice(last)
  return out
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

/** Strip TypeScript syntax from scripts embedded in JS compile output (client + server). */
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

/**
 * Collect compile diagnostics for a `.ave` source without throwing.
 * Used by the language server; `compile()` still throws for Vite/CLI.
 */
export function diagnoseAve(
  source: string,
  options: CompileOptions = {},
): CompileDiagnostic[] {
  const filename = options.filename ?? 'Component.ave'
  let parsed
  try {
    parsed = parse(source)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return [
      sectionDiagnostic(message, { start: 0, end: Math.max(1, source.length) }),
    ]
  }

  const markupRange = parsed.ranges.markup
  const diagnostics: CompileDiagnostic[] = []

  if (options.asUiComponent && parsed.serverScript.trim()) {
    const range = parsed.ranges.serverScript ?? markupRange
    diagnostics.push(
      sectionDiagnostic(
        `UI components cannot have a <script server> (${filename}). Move server logic to a route page or layout.`,
        range,
      ),
    )
  }

  try {
    const { imports: clientImports, body: clientBody } = splitImports(parsed.clientScript)
    const signalNames = collectSignalNames(stripTypeScript(clientBody))
    const components = extractComponentImports(clientImports)
    const markup = parsed.markup || '<!-- empty -->'
    compileMarkup(
      markup,
      'avedon-diag',
      components,
      signalNames,
      parsed.markup ? markupRange.start : 0,
    )
  } catch (e) {
    if (e instanceof CompileError) {
      diagnostics.push(...e.diagnostics)
    } else if (e instanceof Error) {
      diagnostics.push(sectionDiagnostic(e.message, markupRange))
    } else {
      diagnostics.push(sectionDiagnostic(String(e), markupRange))
    }
  }

  return diagnostics
}
