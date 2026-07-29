import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const wwwRoot = path.join(root, '..')
const publicDir = path.join(wwwRoot, 'public')
const require = createRequire(import.meta.url)

await esbuild.build({
  entryPoints: [path.join(wwwRoot, 'src/playground/runtime-shim.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(publicDir, 'playground-runtime.js'),
  logLevel: 'info',
})

const twEntry = require.resolve('@tailwindcss/browser')
const twOut = path.join(publicDir, 'playground-tailwind.js')
fs.copyFileSync(twEntry, twOut)
console.log(`copied ${path.relative(wwwRoot, twEntry)} → public/playground-tailwind.js`)
