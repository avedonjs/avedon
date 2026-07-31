import * as path from 'node:path'
import type { ExtensionContext } from 'vscode'
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'

let client: LanguageClient | undefined

export async function activate(context: ExtensionContext): Promise<void> {
  // Bundled by esbuild into dist/server.js (self-contained for VSIX / pnpm).
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'avedon' }],
  }

  client = new LanguageClient('avedon', 'Avedon Language Server', serverOptions, clientOptions)
  context.subscriptions.push(client)
  await client.start()
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop()
    client = undefined
  }
}
