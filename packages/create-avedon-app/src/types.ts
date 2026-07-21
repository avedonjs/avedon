export type OrmChoice = 'none' | 'drizzle' | 'prisma'

export type ScaffoldOptions = {
  name?: string
  tailwind?: boolean
  orm?: OrmChoice
}

export type ScaffoldResult = {
  dest: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  tailwind: boolean
  orm: OrmChoice
}

export type CreateOptions = {
  name: string
  tailwind: boolean
  orm: OrmChoice
}
