import { defineRoutes } from '@vexjs/server'
import Home from './pages/Home.vex'

export const routes = defineRoutes([
  { path: '/', component: Home, render: 'ssr' },
])

export default routes
