import { describe, expect, it } from 'vitest'
import { parseCreateArgs, resolveCreateOptions } from './options.js'

describe('parseCreateArgs', () => {
  it('parses name and defaults', () => {
    expect(parseCreateArgs(['my-app'])).toEqual({
      name: 'my-app',
      yes: false,
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
})

describe('resolveCreateOptions', () => {
  it('uses defaults with --yes', async () => {
    const opts = await resolveCreateOptions(['--yes'], { stdinIsTTY: true })
    expect(opts).toEqual({ name: 'my-avedon-app', tailwind: false, orm: 'none' })
  })

  it('honors flags without prompting even on TTY', async () => {
    const opts = await resolveCreateOptions(['shop', '--tailwind', '--orm=prisma'], {
      stdinIsTTY: true,
    })
    expect(opts).toEqual({ name: 'shop', tailwind: true, orm: 'prisma' })
  })

  it('skips prompts when not a TTY', async () => {
    const opts = await resolveCreateOptions([], { stdinIsTTY: false })
    expect(opts).toEqual({ name: 'my-avedon-app', tailwind: false, orm: 'none' })
  })
})
