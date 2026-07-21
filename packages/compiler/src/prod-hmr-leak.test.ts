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
  import { signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template><p>{n}</p></template>
`,
      { filename: 'X.avedon', hmr: false },
    )
    expect(code).not.toContain('getHmrState')
    expect(code).not.toContain('__hmr')
    expect(code).not.toContain('avedon:update')
  })

  it(
    'example client build does not contain avedon:update or getHmrState',
    { timeout: 120_000 },
    () => {
      const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
      execSync('pnpm -F @avedon/compiler build && pnpm -F @avedon/vite-plugin build && pnpm -F example build:app', {
        cwd: repoRoot,
        stdio: 'pipe',
      })
      const clientJs = path.join(repoRoot, 'examples/basic-app/build/client/assets/client.js')
      expect(fs.existsSync(clientJs)).toBe(true)
      const joined = fs.readFileSync(clientJs, 'utf8')
      expect(joined).not.toContain('avedon:update')
      expect(joined).not.toContain('getHmrState')
      expect(joined).not.toContain('__hmrPrepareSignals')
    },
  )
})
