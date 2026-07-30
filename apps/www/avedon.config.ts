import { staticAdapter } from '@avedon/adapter-static'

export default {
  adapter: staticAdapter({ out: 'build' }),
}
