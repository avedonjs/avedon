import { defineRoutes } from '@avedon/server'
import Home from './pages/Home.ave'

export const routes = defineRoutes([
  { path: '/', component: Home, render: 'ssr' },
])

export default routes
