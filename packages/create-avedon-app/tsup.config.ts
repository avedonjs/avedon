import fs from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: { entry: { index: 'src/index.ts' } },
  clean: true,
  async onSuccess() {
    const cliPath = 'dist/cli.js'
    const code = fs.readFileSync(cliPath, 'utf8')
    if (!code.startsWith('#!')) {
      fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${code}`)
      fs.chmodSync(cliPath, 0o755)
    }
  },
})
