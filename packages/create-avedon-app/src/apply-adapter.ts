import fs from 'node:fs'
import path from 'node:path'
import type { AdapterChoice } from './types.js'

const AVEDON_DEP = '^0.1.0'
const WRANGLER_DEP = '^4.113.0'

export function applyAdapter(
  appDir: string,
  adapter: AdapterChoice,
  opts: { name: string },
): void {
  if (adapter === 'node') return

  const pkgPath = path.join(appDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  pkg.dependencies ??= {}
  pkg.devDependencies ??= {}
  pkg.scripts ??= {}

  delete pkg.dependencies['@avedon/adapter-node']

  if (adapter === 'cloudflare') {
    pkg.dependencies['@avedon/adapter-cloudflare'] = AVEDON_DEP
    pkg.devDependencies.wrangler = WRANGLER_DEP
    pkg.scripts.start = 'cd build && wrangler deploy'
    pkg.scripts.deploy = 'cd build && wrangler deploy'
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { cloudflareAdapter } from '@avedon/adapter-cloudflare'\n\n` +
        `export default {\n` +
        `  adapter: cloudflareAdapter({ out: 'build', name: ${JSON.stringify(opts.name)} }),\n` +
        `}\n`,
    )
  } else {
    pkg.dependencies['@avedon/adapter-bun'] = AVEDON_DEP
    pkg.scripts.start = 'bun run build/server.js'
    pkg.scripts.preview = 'bun run build/server.js'
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { bunAdapter } from '@avedon/adapter-bun'\n\n` +
        `export default {\n` +
        `  adapter: bunAdapter({ out: 'build' }),\n` +
        `}\n`,
    )
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
