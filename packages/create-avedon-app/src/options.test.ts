import { describe, expect, it } from 'vitest'
import { parseCreateArgs, resolveCreateOptions } from './options.js'

describe('parseCreateArgs', () => {
  it('parses name and defaults', () => {
    expect(parseCreateArgs(['my-app'])).toEqual({
      name: 'my-app',
      yes: false,
      adapter: undefined,
      tailwind: undefined,
      orm: undefined,
    })
  })

  it('parses --yes and -y', () => {
    expect(parseCreateArgs(['--yes']).yes).toBe(true)
    expect(parseCreateArgs(['-y', 'x']).yes).toBe(true)
  })

  it('parses --tailwind and --no-tailwind', () => {
    expect(parseCreateArgs(['--tailwind']).tailwind).toBe(true)
    expect(parseCreateArgs(['--no-tailwind']).tailwind).toBe(false)
  })

  it('parses --orm=', () => {
    expect(parseCreateArgs(['--orm=drizzle']).orm).toBe('drizzle')
    expect(parseCreateArgs(['--orm=prisma']).orm).toBe('prisma')
    expect(parseCreateArgs(['--orm=none']).orm).toBe('none')
  })

  it('rejects invalid --orm', () => {
    expect(() => parseCreateArgs(['--orm=sqlite'])).toThrow(/Invalid --orm/)
  })

  it('parses --adapter=', () => {
    expect(parseCreateArgs(['--adapter=node']).adapter).toBe('node')
    expect(parseCreateArgs(['--adapter=cloudflare']).adapter).toBe('cloudflare')
    expect(parseCreateArgs(['--adapter=bun']).adapter).toBe('bun')
  })

  it('rejects invalid --adapter', () => {
    expect(() => parseCreateArgs(['--adapter=deno'])).toThrow(/Invalid --adapter/)
  })
})

describe('resolveCreateOptions', () => {
  it('uses defaults with --yes', async () => {
    const opts = await resolveCreateOptions(['--yes'], { stdinIsTTY: true })
    expect(opts).toEqual({
      name: 'my-avedon-app',
      adapter: 'node',
      tailwind: false,
      orm: 'none',
    })
  })

  it('honors flags without prompting even on TTY', async () => {
    const opts = await resolveCreateOptions(
      ['shop', '--adapter=node', '--tailwind', '--orm=prisma'],
      {
        stdinIsTTY: true,
      },
    )
    expect(opts).toEqual({
      name: 'shop',
      adapter: 'node',
      tailwind: true,
      orm: 'prisma',
    })
  })

  it('honors --adapter without prompting', async () => {
    const opts = await resolveCreateOptions(
      ['shop', '--adapter=bun', '--no-tailwind', '--orm=none'],
      {
        stdinIsTTY: true,
      },
    )
    expect(opts.adapter).toBe('bun')
    expect(opts.name).toBe('shop')
  })

  it('skips prompts when not a TTY', async () => {
    const opts = await resolveCreateOptions([], { stdinIsTTY: false })
    expect(opts).toEqual({
      name: 'my-avedon-app',
      adapter: 'node',
      tailwind: false,
      orm: 'none',
    })
  })
})
