import { describe, expect, it } from 'vitest'
import { collectSignalNames, prepareSignalExpr } from './signal-script.js'

describe('prepareSignalExpr', () => {
  it('rewrites signal assignment and reads in arrow handlers', () => {
    // Trailing `()` on the next line would ASI-attach to signal(false) — keep decls alone.
    const names = collectSignalNames('const active = signal(false)')
    const out = prepareSignalExpr('() => active = !active', names)
    expect(out).toContain('active.set(!active.get())')
  })

  it('rewrites ternary signal reads', () => {
    const names = collectSignalNames('const active = signal(false)')
    const out = prepareSignalExpr('active ? "Active" : "Inactive"', names)
    expect(out).toContain('active.get() ? "Active" : "Inactive"')
  })

  it('leaves non-signal identifiers alone', () => {
    const names = collectSignalNames('const active = signal(false)')
    const out = prepareSignalExpr('count + 1', names)
    expect(out).toBe('count + 1')
  })

  it('rewrites compound assignment and increment', () => {
    const names = collectSignalNames('const n = signal(0)')
    expect(prepareSignalExpr('n += 2', names)).toContain('n.set(n.get() + 2)')
    expect(prepareSignalExpr('n++', names)).toMatch(/n\.update/)
  })

  it('does not treat nested or string signal decls as bindings', () => {
    const src = `const real = signal(1)
function f() { const value = signal(2); return value }
const s = "const value = signal(9)"`
    const names = collectSignalNames(src)
    expect(names.has('real')).toBe(true)
    expect(names.has('value')).toBe(false)
  })
})
