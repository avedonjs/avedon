import { describe, expect, it } from 'vitest'
import { compile } from './index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

describe('prod HMR leak', () => {
  it('hmr:false compile has no HMR surface', () => {
    const { code } = compile(
      `
<script>
  import { signal } from '@vexjs/runtime'
  const n = signal(0)
</script>
<template><p>{n}</p></template>
`,
      { filename: 'X.vex', hmr: false },
    )
    expect(code).not.toContain('getHmrState')
    expect(code).not.toContain('__hmr')
    expect(code).not.toContain('vex:update')
  })

  it(
    'example client build does not contain vex:update or getHmrState',
    { timeout: 120_000 },
    () => {
      const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
      execSync('pnpm -F @vexjs/compiler build && pnpm -F @vexjs/vite-plugin build && pnpm -F example build:app', {
        cwd: repoRoot,
        stdio: 'pipe',
      })
      const clientJs = path.join(repoRoot, 'examples/basic-app/build/client/assets/client.js')
      expect(fs.existsSync(clientJs)).toBe(true)
      const joined = fs.readFileSync(clientJs, 'utf8')
      expect(joined).not.toContain('vex:update')
      expect(joined).not.toContain('getHmrState')
      expect(joined).not.toContain('__hmrPrepareSignals')
    },
  )
})
