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

/**
 * Extract Params type string for dts from `load` parameter annotation.
 * Supports:
 * - `LoadEvent<'/posts/:id'>` → `import('@avedon/shared').ExtractParams<'/posts/:id'>`
 * - `LoadContext<{ id: string }>` → `{ id: string }`
 * Returns `undefined` when no usable annotation (caller uses `Record<string, string>`).
 */
export function extractLoadParamsType(serverScript: string): string | undefined {
  if (!serverScript.trim() || !HAS_LOAD_RE.test(serverScript)) return undefined

  // load({ ... }: Type) or load(event: Type) or load(_: Type)
  const header =
    /export\s+(?:async\s+)?function\s+load\s*\(([^)]*)\)/.exec(serverScript) ||
    /export\s+const\s+load\s*=\s*async\s*\(([^)]*)\)/.exec(serverScript)
  if (!header) return undefined
  const params = header[1]
  const typed = /:\s*([\s\S]+)$/.exec(params.trim())
  if (!typed) return undefined
  return normalizeEventParamsType(typed[1].trim())
}

/** Action names from `export const actions = { foo, async bar() {}, ... }`. */
export function extractActionKeys(serverScript: string): string[] {
  const m = /export\s+(?:const|let|var)\s+actions\s*=\s*\{/.exec(serverScript)
  if (!m) return []
  const start = m.index + m[0].length
  let depth = 1
  let i = start
  for (; i < serverScript.length; i++) {
    const c = serverScript[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = serverScript.slice(start, i)
  const keys: string[] = []
  // Only top-level keys inside the actions object (depth === 0 relative to body).
  let d = 0
  let j = 0
  while (j < body.length) {
    const c = body[j]
    if (c === '{') {
      d++
      j++
      continue
    }
    if (c === '}') {
      d--
      j++
      continue
    }
    if (c === '(') {
      // skip paren groups (params) at any depth
      let pd = 1
      j++
      while (j < body.length && pd > 0) {
        if (body[j] === '(') pd++
        else if (body[j] === ')') pd--
        j++
      }
      continue
    }
    if (d === 0) {
      const rest = body.slice(j)
      const km = /^(?:async\s+)?([A-Za-z_$][\w$]*)\s*[\(:]/.exec(rest)
      if (km) {
        keys.push(km[1])
        j += km[0].length
        continue
      }
    }
    j++
  }
  return [...new Set(keys)]
}

function normalizeEventParamsType(eventType: string): string | undefined {
  const t = eventType.replace(/\s+/g, ' ').trim()
  // LoadEvent<'/posts/:id'>
  const loadEventPath = /(?:LoadEvent)\s*<\s*(['"])(\/[^'"]*|[^'"]+)\1\s*>/.exec(t)
  if (loadEventPath) {
    const path = loadEventPath[2]
    return `import('@avedon/shared').ExtractParams<'${path}'>`
  }
  // LoadContext<{ id: string }>
  const loadCtx = /(?:LoadContext)\s*<\s*(\{[\s\S]*\})\s*>/.exec(t)
  if (loadCtx) {
    return loadCtx[1].replace(/\s+/g, ' ').trim()
  }
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
    unwrapped = inner
  }
  return extractDataField(unwrapped)
}

function extractDataField(returnType: string): string | undefined {
  const m = /^\{\s*data\s*:\s*([\s\S]+)\}$/.exec(returnType.trim())
  if (!m) {
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

type __AvedonLoadReturn = Awaited<ReturnType<typeof load>>
type __AvedonData = __AvedonLoadReturn extends Response
  ? never
  : __AvedonLoadReturn extends { data: infer D }
    ? D
    : __AvedonLoadReturn extends void | undefined | null
      ? undefined
      : __AvedonLoadReturn
`

  const fileName = '/virtual/avedon-load.ts'
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
    if (name === fileName || name.endsWith('avedon-load.ts')) {
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
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === '__AvedonData') {
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
        return ''
      }
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
      if (/^[A-Za-z_$][\w$]*$/.test(c)) {
        stubs.push(`declare const ${c}: any;`)
        return ''
      }
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
