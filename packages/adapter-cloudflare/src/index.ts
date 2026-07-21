import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'

/** Interface-only stub — Cloudflare Workers adapter not implemented yet. */
export function cloudflareAdapter(_options: { out?: string } = {}): AdapterInterface {
  return {
    name: '@avedon/adapter-cloudflare',
    async adapt(_builder: AdapterBuilder) {
      throw new Error('@avedon/adapter-cloudflare is not implemented yet')
    },
  }
}

export type { AdapterInterface as Adapter, AdapterBuilder as Builder }
export default cloudflareAdapter
