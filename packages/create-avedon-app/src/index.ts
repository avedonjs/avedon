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
