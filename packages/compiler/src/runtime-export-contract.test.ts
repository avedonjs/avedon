import { describe, expect, it } from 'vitest'
import * as runtime from '@avedon/runtime'
import { compile, compileSsr } from './index.js'

function importedRuntimeNames(code: string): string[] {
  const names = new Set<string>()
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]@avedon\/runtime['"]/g
  for (const m of code.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const bit = part.trim()
      if (!bit) continue
      const [left] = bit.split(/\s+as\s+/)
      names.add(left.trim())
    }
  }
  return [...names]
}

describe('runtime export contract', () => {
  it('client and ssr codegen only import existing @avedon/runtime exports', () => {
    const source = `<script>
  import { signal, onMount, setContext } from '@avedon/runtime'
  const n = signal(0)
  onMount(() => {})
  setContext('k', 1)
</script>
<button on:click={() => n.set(n.get() + 1)}>{n.get()}</button>`

    const clientOut = compile(source, { filename: 'Contract.ave', hmr: false })
    const ssrOut = compileSsr(source, { filename: 'Contract.ave' })

    for (const out of [clientOut, ssrOut]) {
      const names = importedRuntimeNames(out.code)
      expect(names.length).toBeGreaterThan(0)
      for (const name of names) {
        expect(name in runtime, `missing runtime export: ${name}`).toBe(true)
      }
    }
  })
})
