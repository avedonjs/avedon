import { defineRoutes } from '@avedon/server'
import Home from './pages/Home.avedon'

export const routes = defineRoutes([
  { path: '/', component: Home, render: 'ssr' },
])

export default routes
