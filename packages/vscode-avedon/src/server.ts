#!/usr/bin/env node
import { startLanguageServer } from '@avedon/language-server'

// vscode-languageserver requires an explicit transport flag when argv is empty.
if (
  !process.argv.includes('--stdio') &&
  !process.argv.includes('--node-ipc') &&
  !process.argv.some((a) => a.startsWith('--socket='))
) {
  process.argv.push('--stdio')
}

startLanguageServer()
