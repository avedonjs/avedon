import * as p from '@clack/prompts'
import type { AdapterChoice, CreateOptions, OrmChoice } from './types.js'

export type ParsedCreateArgs = {
  name?: string
  yes: boolean
  adapter?: AdapterChoice
  tailwind?: boolean
  orm?: OrmChoice
}

const ORMS = new Set<OrmChoice>(['none', 'drizzle', 'prisma'])
const ADAPTERS = new Set<AdapterChoice>(['node', 'cloudflare', 'bun'])

export function parseCreateArgs(argv: string[]): ParsedCreateArgs {
  let name: string | undefined
  let yes = false
  let adapter: AdapterChoice | undefined
  let tailwind: boolean | undefined
  let orm: OrmChoice | undefined

  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') {
      yes = true
      continue
    }
    if (arg === '--tailwind') {
      tailwind = true
      continue
    }
    if (arg === '--no-tailwind') {
      tailwind = false
      continue
    }
    if (arg.startsWith('--adapter=')) {
      const value = arg.slice('--adapter='.length) as AdapterChoice
      if (!ADAPTERS.has(value)) {
        throw new Error(`Invalid --adapter=${value} (expected node|cloudflare|bun)`)
      }
      adapter = value
      continue
    }
    if (arg.startsWith('--orm=')) {
      const value = arg.slice('--orm='.length) as OrmChoice
      if (!ORMS.has(value)) {
        throw new Error(`Invalid --orm=${value} (expected none|drizzle|prisma)`)
      }
      orm = value
      continue
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
    if (name !== undefined) {
      throw new Error(`Unexpected argument: ${arg}`)
    }
    name = arg
  }

  return { name, yes, adapter, tailwind, orm }
}

export async function resolveCreateOptions(
  argv: string[],
  opts?: { stdinIsTTY?: boolean },
): Promise<CreateOptions> {
  const parsed = parseCreateArgs(argv)
  const tty = opts?.stdinIsTTY ?? Boolean(process.stdin.isTTY)
  const forceDefaults = parsed.yes || !tty

  if (forceDefaults) {
    return {
      name: parsed.name ?? 'my-avedon-app',
      adapter: parsed.adapter ?? 'node',
      tailwind: parsed.tailwind ?? false,
      orm: parsed.orm ?? 'none',
    }
  }

  let name = parsed.name
  if (!name) {
    const answered = await p.text({
      message: 'Project name',
      placeholder: 'my-avedon-app',
      defaultValue: 'my-avedon-app',
    })
    if (p.isCancel(answered)) process.exit(0)
    name = String(answered).trim() || 'my-avedon-app'
  }

  let adapter = parsed.adapter
  if (adapter === undefined) {
    const answered = await p.select({
      message: 'Production adapter?',
      options: [
        { value: 'node' as const, label: 'Node' },
        { value: 'cloudflare' as const, label: 'Cloudflare Workers' },
        { value: 'bun' as const, label: 'Bun' },
      ],
      initialValue: 'node' as const,
    })
    if (p.isCancel(answered)) process.exit(0)
    adapter = answered as AdapterChoice
  }

  let tailwind = parsed.tailwind
  if (tailwind === undefined) {
    const answered = await p.confirm({
      message: 'Add Tailwind CSS?',
      initialValue: false,
    })
    if (p.isCancel(answered)) process.exit(0)
    tailwind = Boolean(answered)
  }

  let orm = parsed.orm
  if (orm === undefined) {
    const answered = await p.select({
      message: 'Add an ORM?',
      options: [
        { value: 'none' as const, label: 'None' },
        { value: 'drizzle' as const, label: 'Drizzle' },
        { value: 'prisma' as const, label: 'Prisma' },
      ],
      initialValue: 'none' as const,
    })
    if (p.isCancel(answered)) process.exit(0)
    orm = answered as OrmChoice
  }

  return { name, adapter, tailwind, orm }
}
