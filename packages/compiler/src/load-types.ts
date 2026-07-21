import ts from 'typescript'

const HAS_LOAD_RE =
  /\bexport\s+(?:async\s+)?function\s+load\b|\bexport\s+(?:const|let|var)\s+load\b/

/**
 * Infer the `data` prop type string from a `<script server>` block's `load` export.
 * Returns:
 * - `undefined` if there is no `load` export (caller should omit `data` from Props)
 * - a type string (e.g. `{ post: Post }`) when inference succeeds
 * - `never` is avoided; on failure returns a best-effort annotation parse or skips
 */
export function inferLoadDataType(serverScript: string): string | undefined {
  if (!serverScript.trim() || !HAS_LOAD_RE.test(serverScript)) return undefined

  const fromAnnotation = extractDataTypeFromAnnotation(serverScript)
  if (fromAnnotation) return fromAnnotation

  const fromChecker = extractDataTypeWithChecker(serverScript)
  if (fromChecker) return fromChecker

  return undefined
}

/** Parse `load(...): Promise<{ data: T }>` / `load(...): { data: T }` annotations. */
function extractDataTypeFromAnnotation(serverScript: string): string | undefined {
  const header =
    /export\s+(?:async\s+)?function\s+load\s*\([^)]*\)\s*:/.exec(serverScript) ||
    /export\s+const\s+load\s*=\s*async\s*\([^)]*\)\s*:/.exec(serverScript)
  if (!header) return undefined
  const start = header.index! + header[0].length
  const ret = takeTypeExpr(serverScript.slice(start)).trim()
  if (!ret) return undefined
  let unwrapped = ret
  const promise = /^Promise\s*</.exec(unwrapped)
  if (promise) {
    const inner = takeTypeExpr(unwrapped.slice(unwrapped.indexOf('<') + 1))
    // strip trailing `>` already handled by takeTypeExpr stopping at depth 0 `>`
    unwrapped = inner
  }
  return extractDataField(unwrapped)
}

function extractDataField(returnType: string): string | undefined {
  // `{ data: T }` or `{ data: T; ... }`
  const m = /^\{\s*data\s*:\s*([\s\S]+)\}$/.exec(returnType.trim())
  if (!m) {
    // Might be `{ data: T; ok?: boolean }` — find data: with balanced braces
    const dataIdx = returnType.search(/\bdata\s*:/)
    if (dataIdx < 0) return undefined
    const after = returnType.slice(dataIdx).replace(/^\s*data\s*:\s*/, '')
    return takeTypeExpr(after)
  }
  return takeTypeExpr(m[1]).trim()
}

function takeTypeExpr(input: string): string {
  let depth = 0
  let i = 0
  for (; i < input.length; i++) {
    const c = input[i]
    if (c === '{' || c === '<' || c === '(' || c === '[') depth++
    else if (c === '}' || c === '>' || c === ')' || c === ']') {
      if (depth === 0) break
      depth--
    } else if ((c === ',' || c === ';') && depth === 0) break
  }
  return input.slice(0, i).trim()
}

function extractDataTypeWithChecker(serverScript: string): string | undefined {
  const stubbed = stubImports(serverScript)
  const source = `${stubbed}

type __VexLoadReturn = Awaited<ReturnType<typeof load>>
type __VexData = __VexLoadReturn extends Response
  ? never
  : __VexLoadReturn extends { data: infer D }
    ? D
    : __VexLoadReturn extends void | undefined | null
      ? undefined
      : __VexLoadReturn
`

  const fileName = '/virtual/vex-load.ts'
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
  }

  const host = ts.createCompilerHost(options)
  const origGetSourceFile = host.getSourceFile.bind(host)
  const origFileExists = host.fileExists!.bind(host)
  const origReadFile = host.readFile!.bind(host)
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (name === fileName || name.endsWith('vex-load.ts')) {
      return ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.TS)
    }
    return origGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
  }
  host.fileExists = (n) => n === fileName || origFileExists(n)
  host.readFile = (n) => (n === fileName ? source : origReadFile(n))

  const program = ts.createProgram([fileName], options, host)
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(fileName)
  if (!sf) return undefined

  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === '__VexData') {
      const type = checker.getTypeFromTypeNode(stmt.type)
      const printed = checker.typeToString(
        type,
        stmt,
        ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
      )
      if (!printed || printed === 'any' || printed === 'unknown' || printed === 'never') {
        return undefined
      }
      if (printed === 'undefined') return undefined
      return printed
    }
  }
  return undefined
}

/** Replace ESM imports with ambient stubs so the checker can run in isolation. */
function stubImports(script: string): string {
  const stubs: string[] = []
  const body = script.replace(
    /^\s*import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?\s*$/gm,
    (_full, clause: string) => {
      const c = clause.trim()
      if (c.startsWith('type ')) {
        // type-only import — drop; types must be local or we lose them
        return ''
      }
      // import { a, b as c } from '...'
      const named = /^\{\s*([^}]+)\s*\}$/.exec(c)
      if (named) {
        for (const part of named[1].split(',')) {
          const p = part.trim()
          if (!p) continue
          const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim())
          const name = alias || orig
          if (name === 'type') continue
          stubs.push(`declare const ${name}: any;`)
        }
        return ''
      }
      // import Default from '...'
      if (/^[A-Za-z_$][\w$]*$/.test(c)) {
        stubs.push(`declare const ${c}: any;`)
        return ''
      }
      // import * as ns
      const star = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(c)
      if (star) {
        stubs.push(`declare const ${star[1]}: any;`)
        return ''
      }
      return ''
    },
  )
  return stubs.join('\n') + '\n' + body
}
