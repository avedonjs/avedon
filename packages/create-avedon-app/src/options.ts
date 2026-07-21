import * as p from '@clack/prompts'
import type { CreateOptions, OrmChoice } from './types.js'

export type ParsedCreateArgs = {
  name?: string
  yes: boolean
  tailwind?: boolean
  orm?: OrmChoice
}

const ORMS = new Set<OrmChoice>(['none', 'drizzle', 'prisma'])

export function parseCreateArgs(argv: string[]): ParsedCreateArgs {
  let name: string | undefined
  let yes = false
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

  return { name, yes, tailwind, orm }
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

  return { name, tailwind, orm }
}
