import type { AdapterBuilder, AdapterInterface } from '@vexjs/shared'

/** Interface-only stub — Bun adapter not implemented yet. */
export function bunAdapter(_options: { out?: string } = {}): AdapterInterface {
  return {
    name: '@vexjs/adapter-bun',
    async adapt(_builder: AdapterBuilder) {
      throw new Error('@vexjs/adapter-bun is not implemented yet')
    },
  }
}

export type { AdapterInterface as Adapter, AdapterBuilder as Builder }
export default bunAdapter
