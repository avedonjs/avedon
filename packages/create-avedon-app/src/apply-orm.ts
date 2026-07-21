import fs from 'node:fs'
import path from 'node:path'
import type { OrmChoice } from './types.js'

type PkgJson = {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
  [key: string]: unknown
}

function readPkg(appDir: string): { pkgPath: string; pkg: PkgJson } {
  const pkgPath = path.join(appDir, 'package.json')
  const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Partial<PkgJson>
  const pkg: PkgJson = {
    ...raw,
    dependencies: raw.dependencies ?? {},
    devDependencies: raw.devDependencies ?? {},
    scripts: raw.scripts ?? {},
  }
  return { pkgPath, pkg }
}

function ensureDatabaseUrlExample(appDir: string) {
  const envPath = path.join(appDir, '.env.example')
  const stub = 'DATABASE_URL=\n'
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, stub)
    return
  }
  const cur = fs.readFileSync(envPath, 'utf8')
  if (!cur.includes('DATABASE_URL=')) {
    fs.writeFileSync(envPath, cur.endsWith('\n') ? cur + stub : `${cur}\n${stub}`)
  }
}

export function applyOrm(appDir: string, orm: OrmChoice): void {
  if (orm === 'none') return
  ensureDatabaseUrlExample(appDir)
  const { pkgPath, pkg } = readPkg(appDir)

  if (orm === 'drizzle') {
    pkg.dependencies['drizzle-orm'] = '^0.44.2'
    pkg.devDependencies['drizzle-kit'] = '^0.31.4'
    pkg.scripts['db:generate'] = 'drizzle-kit generate'
    pkg.scripts['db:push'] = 'drizzle-kit push'
    fs.writeFileSync(
      path.join(appDir, 'drizzle.config.ts'),
      `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
`,
    )
  }

  if (orm === 'prisma') {
    pkg.dependencies['@prisma/client'] = '^6.11.1'
    pkg.devDependencies.prisma = '^6.11.1'
    pkg.scripts['db:generate'] = 'prisma generate'
    fs.mkdirSync(path.join(appDir, 'prisma'), { recursive: true })
    fs.writeFileSync(
      path.join(appDir, 'prisma/schema.prisma'),
      `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`,
    )
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
