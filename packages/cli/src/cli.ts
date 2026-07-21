import { nodeAdapter, type Builder } from '@vexjs/adapter-node'
import { paramsFromPath, renderShell, resolveComponent, type Routes } from '@vexjs/server'
import { vex } from '@vexjs/vite-plugin'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build as viteBuild, createServer } from 'vite'

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
      await cmdCreate(args[0] ?? 'my-vex-app')
      break
    default:
      console.error(`Unknown command: ${cmd}\n`)
      printHelp()
      process.exitCode = 1
  }
}

function printHelp() {
  console.log(`vexjs CLI

Usage:
  vex create [name]
  vex dev
  vex build
  vex start
  vex --help
`)
}

async function loadConfig(root = process.cwd()) {
  const jsPath = path.join(root, 'vex.config.js')
  const tsPath = path.join(root, 'vex.config.ts')
  let adapter = nodeAdapter()
  if (fs.existsSync(jsPath)) {
    const mod = await import(pathToFileURL(jsPath).href)
    if (mod.default?.adapter) adapter = mod.default.adapter
    if (mod.adapter) adapter = mod.adapter
  } else if (fs.existsSync(tsPath)) {
    const vite = await createServer({
      root,
      server: { middlewareMode: true },
      plugins: [vex({ root })],
    })
    try {
      const mod = await vite.ssrLoadModule('/vex.config.ts')
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
  const server = await createServer({
    root,
    plugins: [vex({ root })],
    server: { port: 5173 },
  })
  await server.listen()
  server.printUrls()
}

async function cmdBuild() {
  const { adapter, root } = await loadConfig()
  const outDir = path.join(root, '.vex')
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(outDir, 'server'), { recursive: true })
  fs.mkdirSync(path.join(outDir, 'client'), { recursive: true })

  await viteBuild({
    root,
    plugins: [vex({ root })],
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
    plugins: [vex({ root })],
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
      noExternal: [/^@vexjs\//],
    },
  })

  const appHtml = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8')
  const serverEntryPath = path.join(outDir, 'server', 'index.js')
  const serverMod = await import(pathToFileURL(serverEntryPath).href)
  const routes: Routes = serverMod.routes ?? serverMod.default

  const ssgPages: Array<{ path: string; html: string }> = []
  for (const route of flattenRoutes(routes)) {
    if ((route.render ?? 'ssr') !== 'ssg') continue
    const listFn = route.entries ?? route.getStaticPaths
    const paths = listFn != null ? await listFn() : [route.path.includes(':') ? null : route.path]
    for (const p of paths) {
      if (!p) continue
      const mod = await resolveComponent(route.component)
      const params = paramsFromPath(route.path, p) ?? {}
      let data: Record<string, unknown> = {}
      if (mod.load) {
        const loaded = await mod.load({
          params,
          request: new Request(new URL(p, 'http://ssg.local')),
          url: new URL(p, 'http://ssg.local'),
        })
        if (loaded && !(loaded instanceof Response)) data = loaded
      }
      let body = `<div data-vex-page>${mod.render(data)}</div>`
      const cssParts: string[] = []
      if (mod.css) cssParts.push(mod.css)
      // wrap layouts root→leaf reverse
      const chain = [route]
      for (let i = chain.length - 1; i >= 0; i--) {
        const r = chain[i]
        if (!r.layout) continue
        const layout = await resolveComponent(r.layout)
        if (layout.css) cssParts.push(layout.css)
        body = layout.render({ ...data, children: body })
      }
      const html = renderShell(appHtml, {
        body,
        css: cssParts.join('\n'),
        props: data,
        clientEntry: '/assets/client.js',
      })
      ssgPages.push({ path: p, html })
    }
  }

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

function flattenRoutes(routes: Routes): Routes {
  const out: Routes = []
  for (const r of routes) {
    out.push(r)
    if (r.children) out.push(...flattenRoutes(r.children))
  }
  return out
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
    console.error('No build/server.js — run vex build first')
    process.exit(1)
  }
  await import(pathToFileURL(serverPath).href)
}

async function cmdCreate(name: string) {
  const dest = path.resolve(name)
  if (fs.existsSync(dest)) {
    console.error(`Directory exists: ${dest}`)
    process.exit(1)
  }
  writeTemplate(dest, name)
  console.log(`Created ${name}
  cd ${name}
  npm install
  npx vex dev
`)
}

function writeTemplate(dest: string, name: string) {
  const files: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          dev: 'vex dev',
          build: 'vex build',
          preview: 'vex preview',
        },
        dependencies: {
          '@vexjs/adapter-node': '0.1.0',
          '@vexjs/runtime': '0.1.0',
          '@vexjs/server': '0.1.0',
          '@vexjs/vite-plugin': '0.1.0',
          vex: '0.1.0',
        },
        devDependencies: {
          typescript: '^5.8.2',
          vite: '^6.2.2',
        },
      },
      null,
      2,
    ),
    'vex.config.ts': `import { nodeAdapter } from '@vexjs/adapter-node'

export default {
  adapter: nodeAdapter({ out: 'build' }),
}
`,
    'src/app.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %vex.head%
  </head>
  <body>
    <div id="app">%vex.body%</div>
  </body>
</html>
`,
    'src/client.ts': `import 'virtual:vex-client-entry'
`,
    'src/server-entry.ts': `import { routes } from './routes'
import appHtml from './app.html?raw'
export { routes, appHtml }
export { default as hooks } from './hooks.server'
`,
    'src/hooks.server.ts': `import type { HandleHook } from '@vexjs/server'

export const handle: HandleHook = async ({ request, resolve }) => {
  return resolve(request)
}

export default { handle }
`,
    'src/routes.ts': `import type { Routes } from '@vexjs/server'
import Home from './pages/Home.vex'

export const routes: Routes = [
  { path: '/', component: Home, render: 'ssr' },
]
`,
    'src/pages/Home.vex': `<script lang="ts">
  export let title
</script>

<script lang="ts" server>
  export async function load() {
    return { title: 'Welcome to vexjs' }
  }
</script>

<style>
  h1 { font-family: Georgia, serif; }
</style>

<h1>{title}</h1>
<p>Edit src/pages/Home.vex to get started.</p>
`,
    'src/error.vex': `<script lang="ts">
  export let status
  export let message
</script>
<h1>{status}</h1>
<p>{message}</p>
`,
    'src/not-found.vex': `<h1>404</h1>
<p>Page not found.</p>
`,
  }

  for (const [rel, contents] of Object.entries(files)) {
    const file = path.join(dest, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, contents)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
