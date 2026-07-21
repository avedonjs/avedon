import { nodeAdapter, type Builder } from '@avedon/adapter-node'
import type { Routes } from '@avedon/server'
import { avedon } from '@avedon/vite-plugin'
import { formatNextSteps, scaffoldApp } from 'create-avedon-app'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build as viteBuild, createServer } from 'vite'
import { printDevBanner, shouldPrintDevBanner } from './banner.js'
import { buildSsgPages, flattenRoutes } from './ssg.js'

async function main() {
  const [cmd = 'help', ...args] = process.argv.slice(2)
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp()
    return
  }
  switch (cmd) {
    case 'dev':
      await cmdDev()
      break
    case 'build':
      await cmdBuild()
      break
    case 'start':
    case 'preview':
      await cmdPreview()
      break
    case 'create':
      await cmdCreate(args[0] ?? 'my-avedon-app')
      break
    default:
      console.error(`Unknown command: ${cmd}\n`)
      printHelp()
      process.exitCode = 1
  }
}

function printHelp() {
  console.log(`avedon CLI

Usage:
  avedon create [name]
  avedon dev
  avedon build
  avedon start
  avedon --help
`)
}

async function loadConfig(root = process.cwd()) {
  const jsPath = path.join(root, 'avedon.config.js')
  const tsPath = path.join(root, 'avedon.config.ts')
  let adapter = nodeAdapter()
  if (fs.existsSync(jsPath)) {
    const mod = await import(pathToFileURL(jsPath).href)
    if (mod.default?.adapter) adapter = mod.default.adapter
    if (mod.adapter) adapter = mod.adapter
  } else if (fs.existsSync(tsPath)) {
    const vite = await createServer({
      root,
      server: { middlewareMode: true },
      plugins: [avedon({ root })],
    })
    try {
      const mod = await vite.ssrLoadModule('/avedon.config.ts')
      if (mod.default?.adapter) adapter = mod.default.adapter
      if (mod.adapter) adapter = mod.adapter
    } finally {
      await vite.close()
    }
  }
  return { adapter, root }
}

async function cmdDev() {
  const root = process.cwd()
  const devArgv = process.argv.slice(3)
  if (shouldPrintDevBanner(devArgv)) {
    printDevBanner()
  }
  const server = await createServer({
    root,
    plugins: [avedon({ root })],
    server: { port: 5173 },
  })
  await server.listen()
  server.printUrls()
}

async function cmdBuild() {
  const { adapter, root } = await loadConfig()
  const outDir = path.join(root, '.avedon')
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(outDir, 'server'), { recursive: true })
  fs.mkdirSync(path.join(outDir, 'client'), { recursive: true })

  await viteBuild({
    root,
    plugins: [avedon({ root })],
    build: {
      outDir: path.join(outDir, 'client'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(root, 'src/client.ts'),
        output: {
          entryFileNames: 'assets/client.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  })

  await viteBuild({
    root,
    plugins: [avedon({ root })],
    build: {
      ssr: path.join(root, 'src/server-entry.ts'),
      outDir: path.join(outDir, 'server'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
          format: 'esm',
        },
      },
    },
    ssr: {
      noExternal: [/^@avedon\//],
    },
  })

  const appHtml = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8')
  const serverEntryPath = path.join(outDir, 'server', 'index.js')
  const serverMod = await import(pathToFileURL(serverEntryPath).href)
  const routes: Routes = serverMod.routes ?? serverMod.default

  const ssgPages = await buildSsgPages(routes, appHtml)

  const builder: Builder = {
    getClientDirectory: () => path.join(outDir, 'client'),
    getServerEntry: () => serverEntryPath,
    getSsgPages: () => ssgPages,
    getManifest: () => ({
      routes: flattenRoutes(routes).map((r) => ({ path: r.path, render: r.render ?? 'ssr' })),
    }),
    writeClient(dest) {
      copyDir(path.join(outDir, 'client'), dest)
    },
    writeFile(file, contents) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, contents)
    },
    mkdirp(dir) {
      fs.mkdirSync(dir, { recursive: true })
    },
  }

  await adapter.adapt(builder)
  console.log('Build complete → build/')
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

async function cmdPreview() {
  const serverPath = path.join(process.cwd(), 'build', 'server.js')
  if (!fs.existsSync(serverPath)) {
    console.error('No build/server.js — run avedon build first')
    process.exit(1)
  }
  await import(pathToFileURL(serverPath).href)
}

async function cmdCreate(name: string) {
  const dest = path.resolve(name)
  try {
    const result = scaffoldApp(dest, path.basename(dest))
    console.log(formatNextSteps(result))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
