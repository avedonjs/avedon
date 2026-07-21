import { defineRoutes } from '@vexjs/server'
import Layout from './pages/Layout.vex'
import Home from './pages/Home.vex'
import Post from './pages/Post.vex'
import Admin from './pages/Admin.vex'
import AdminError from './pages/AdminError.vex'
import { requireAuth } from './guards/auth'

const routes = defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  {
    path: '/posts/:id',
    layout: Layout,
    component: Post,
    render: 'ssr',
  },
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireAuth,
    error: AdminError,
  },
])

export default routes
export { routes }
