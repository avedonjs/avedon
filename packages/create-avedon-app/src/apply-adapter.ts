import fs from 'node:fs'
import path from 'node:path'
import type { AdapterChoice } from './types.js'

/** Match current npm majors: cloudflare/bun are 0.2.x. */
const ADAPTER_EDGE_RANGE = '^0.2.7'
/** First publish line for @avedon/adapter-static. */
const ADAPTER_STATIC_RANGE = '^0.1.0'
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
    pkg.dependencies['@avedon/adapter-cloudflare'] = ADAPTER_EDGE_RANGE
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
  } else if (adapter === 'bun') {
    pkg.dependencies['@avedon/adapter-bun'] = ADAPTER_EDGE_RANGE
    pkg.scripts.start = 'bun run build/server.js'
    pkg.scripts.preview = 'bun run build/server.js'
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { bunAdapter } from '@avedon/adapter-bun'\n\n` +
        `export default {\n` +
        `  adapter: bunAdapter({ out: 'build' }),\n` +
        `}\n`,
    )
  } else if (adapter === 'static') {
    pkg.dependencies['@avedon/adapter-static'] = ADAPTER_STATIC_RANGE
    delete pkg.scripts.start
    delete pkg.scripts.preview
    fs.writeFileSync(
      path.join(appDir, 'avedon.config.ts'),
      `import { staticAdapter } from '@avedon/adapter-static'\n\n` +
        `export default {\n` +
        `  adapter: staticAdapter({ out: 'build' }),\n` +
        `}\n`,
    )
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
