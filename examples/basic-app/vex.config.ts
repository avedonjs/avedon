import { nodeAdapter } from '@vexjs/adapter-node'

export default {
  adapter: nodeAdapter({ out: 'build' }),
}
