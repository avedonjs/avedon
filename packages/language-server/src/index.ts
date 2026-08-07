import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  type Diagnostic,
  DiagnosticSeverity,
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { diagnoseAve, type CompileDiagnostic } from '@avedon/compiler'
import { getCompletions, getDefinition, getHover } from './features.js'

const DEBOUNCE_MS = 150

/** Map compiler diagnostics to LSP diagnostics for a document. */
export function toLspDiagnostics(
  doc: TextDocument,
  compileDiags: CompileDiagnostic[],
): Diagnostic[] {
  return compileDiags.map((d) => {
    const start = doc.positionAt(Math.max(0, Math.min(d.range.start, doc.getText().length)))
    const end = doc.positionAt(Math.max(0, Math.min(d.range.end, doc.getText().length)))
    return {
      severity: DiagnosticSeverity.Error,
      range: { start, end },
      message: d.message,
      source: 'avedon',
    }
  })
}

/** Diagnose `.ave` source text (testable without LSP transport). */
export function diagnoseDocumentText(text: string, filename = 'file.ave'): CompileDiagnostic[] {
  return diagnoseAve(text, { filename })
}

export {
  getCompletions,
  getDefinition,
  getHover,
  extractComponentImportMap,
  extractScriptSymbols,
  definitionRangeForAveSource,
} from './features.js'

export function startLanguageServer(): void {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function scheduleValidate(doc: TextDocument): void {
    const prev = timers.get(doc.uri)
    if (prev) clearTimeout(prev)
    timers.set(
      doc.uri,
      setTimeout(() => {
        timers.delete(doc.uri)
        validate(doc)
      }, DEBOUNCE_MS),
    )
  }

  function validate(doc: TextDocument): void {
    const filename = doc.uri.split('/').pop() ?? 'file.ave'
    const diags = diagnoseDocumentText(doc.getText(), filename)
    connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics: toLspDiagnostics(doc, diags),
    })
  }

  connection.onInitialize((_params: InitializeParams): InitializeResult => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          triggerCharacters: ['{', '#', '@', ':', '<'],
        },
        hoverProvider: true,
        definitionProvider: true,
      },
    }
  })

  connection.onCompletion((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    return getCompletions(doc, params.position)
  })

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    return getHover(doc, params.position)
  })

  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    return getDefinition(doc, params.position)
  })

  documents.onDidOpen((e) => scheduleValidate(e.document))
  documents.onDidChangeContent((e) => scheduleValidate(e.document))
  documents.onDidClose((e) => {
    const t = timers.get(e.document.uri)
    if (t) clearTimeout(t)
    timers.delete(e.document.uri)
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] })
  })

  documents.listen(connection)
  connection.listen()
}
