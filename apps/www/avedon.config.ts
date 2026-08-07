import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

/** Workers+Assets build; `build/client` is still deployed to Cloudflare Pages (pages.dev). */
export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'avedon' }),
}
