import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ScaffoldResult = {
  dest: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
}

function detectPackageManager(): ScaffoldResult['packageManager'] {
  const ua = process.env.npm_config_user_agent ?? ''
  if (ua.includes('pnpm')) return 'pnpm'
  if (ua.includes('yarn')) return 'yarn'
  if (ua.includes('bun')) return 'bun'
  if (process.env.PNPM_HOME || fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  return 'npm'
}

function templateRoot(): string {
  // dist/index.js → ../template
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template')
}

const LOCAL_PKG_DIRS: Record<string, string> = {
  avedon: 'cli',
  '@avedon/adapter-node': 'adapter-node',
  '@avedon/runtime': 'runtime',
  '@avedon/server': 'server',
  '@avedon/vite-plugin': 'vite-plugin',
}

/** Resolve avedon monorepo root (packages/cli + pnpm-workspace.yaml). */
export function findAvedonMonorepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 25; i++) {
    const ws = path.join(dir, 'pnpm-workspace.yaml')
    const cliPkg = path.join(dir, 'packages', 'cli', 'package.json')
    if (fs.existsSync(ws) && fs.existsSync(cliPkg)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(cliPkg, 'utf8')) as { name?: string }
        if (pkg.name === 'avedon') return dir
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** Point scaffold deps at local packages when inside the avedon monorepo (CI / contributors). */
export function linkScaffoldToMonorepo(appDir: string, monorepoRoot: string): void {
  const pkgPath = path.join(appDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  if (!pkg.dependencies) return

  const packagesDir = path.join(monorepoRoot, 'packages')
  for (const [name, relDir] of Object.entries(LOCAL_PKG_DIRS)) {
    if (!(name in pkg.dependencies)) continue
    const abs = path.join(packagesDir, relDir)
    if (!fs.existsSync(path.join(abs, 'package.json'))) continue
    const rel = path.relative(appDir, abs).split(path.sep).join('/')
    pkg.dependencies[name] = `file:${rel}`
  }
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

function copyDir(src: string, dest: string, name: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(from, to, name)
    } else {
      let contents = fs.readFileSync(from, 'utf8')
      contents = contents.replaceAll('__APP_NAME__', name)
      fs.writeFileSync(to, contents)
    }
  }
}

/** Scaffold a new avedon app into `dest` (absolute or relative). */
export function scaffoldApp(destInput: string, name = path.basename(destInput)): ScaffoldResult {
  const dest = path.resolve(destInput)
  if (fs.existsSync(dest)) {
    throw new Error(`Directory exists: ${dest}`)
  }
  const tmpl = templateRoot()
  if (!fs.existsSync(tmpl)) {
    throw new Error(`Template not found at ${tmpl}`)
  }
  copyDir(tmpl, dest, name)

  const monorepoRoot =
    process.env.AVEDON_MONOREPO_ROOT?.trim() ||
    findAvedonMonorepoRoot(process.cwd()) ||
    findAvedonMonorepoRoot(path.dirname(fileURLToPath(import.meta.url)))
  if (monorepoRoot) {
    linkScaffoldToMonorepo(dest, monorepoRoot)
  }

  return { dest, name, packageManager: detectPackageManager() }
}

export function formatNextSteps(result: ScaffoldResult): string {
  const { name, packageManager } = result
  const install =
    packageManager === 'pnpm'
      ? 'pnpm install'
      : packageManager === 'yarn'
        ? 'yarn'
        : packageManager === 'bun'
          ? 'bun install'
          : 'npm install'
  const run =
    packageManager === 'pnpm'
      ? 'pnpm avedon dev'
      : packageManager === 'yarn'
        ? 'yarn avedon dev'
        : packageManager === 'bun'
          ? 'bunx avedon dev'
          : 'npx avedon dev'
  return `Created ${name}

  cd ${name}
  ${install}
  ${run}
`
}
