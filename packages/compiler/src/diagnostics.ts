/** UTF-16 code unit offsets into the full `.ave` source (LSP-compatible). */
export interface SourceRange {
  start: number
  end: number
}

export interface CompileDiagnostic {
  message: string
  range: SourceRange
  severity: 'error'
}

export class CompileError extends Error {
  readonly diagnostics: CompileDiagnostic[]

  constructor(message: string, diagnostics: CompileDiagnostic[]) {
    super(message)
    this.name = 'CompileError'
    this.diagnostics = diagnostics
  }
}

export interface ErrorContext {
  /** Absolute file offset of the current input string. */
  base: number
  /** Length of the current input (for section-wide fallback). */
  length: number
  /** Last known local offset within the current input. */
  pos: number
}

let errorCtx: ErrorContext = { base: 0, length: 0, pos: 0 }

export function getErrorContext(): ErrorContext {
  return errorCtx
}

export function setErrorContext(ctx: ErrorContext): ErrorContext {
  const prev = errorCtx
  errorCtx = ctx
  return prev
}

export function updateErrorPos(localPos: number): void {
  errorCtx.pos = localPos
}

/** Throw a CompileError with an absolute file range (or context-relative default). */
export function fail(message: string, absStart?: number, absEnd?: number): never {
  const start =
    absStart ?? errorCtx.base + Math.min(errorCtx.pos, Math.max(0, errorCtx.length))
  let end = absEnd ?? start + 1
  if (absStart == null && absEnd == null && errorCtx.length > 0) {
    // Prefer a 1-char caret at pos; clamp into the active section.
    const sectionEnd = errorCtx.base + errorCtx.length
    end = Math.min(Math.max(start + 1, start), sectionEnd)
    if (end <= start) end = Math.min(start + 1, sectionEnd)
  }
  if (end < start) end = start
  const diagnostic: CompileDiagnostic = {
    message,
    range: { start, end: Math.max(end, start) },
    severity: 'error',
  }
  throw new CompileError(message, [diagnostic])
}

/** Fail at a local offset within the current error context's input. */
export function failAt(localStart: number, message: string, localEnd?: number): never {
  const start = errorCtx.base + localStart
  const end = errorCtx.base + (localEnd ?? localStart + 1)
  return fail(message, start, Math.max(end, start))
}

/** Section-wide fallback diagnostic (no precise caret). */
export function sectionDiagnostic(
  message: string,
  range: SourceRange,
): CompileDiagnostic {
  return {
    message,
    range: {
      start: range.start,
      end: Math.max(range.end, range.start),
    },
    severity: 'error',
  }
}
