export type AdapterChoice = 'node' | 'cloudflare' | 'bun'

export type OrmChoice = 'none' | 'drizzle' | 'prisma'

export type ScaffoldOptions = {
  name?: string
  adapter?: AdapterChoice
  tailwind?: boolean
  orm?: OrmChoice
}

export type ScaffoldResult = {
  dest: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  adapter: AdapterChoice
  tailwind: boolean
  orm: OrmChoice
}

export type CreateOptions = {
  name: string
  adapter: AdapterChoice
  tailwind: boolean
  orm: OrmChoice
}
