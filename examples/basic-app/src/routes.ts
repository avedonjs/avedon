import { defineRoutes } from '@vexjs/server'
import Layout from './pages/Layout.vex'
import Home from './pages/Home.vex'
import Post from './pages/Post.vex'
import Admin from './pages/Admin.vex'
import AdminError from './pages/AdminError.vex'
import Doc from './pages/Doc.vex'
import Stream from './pages/Stream.vex'
import { requireAuth } from './guards/auth'

const routes = defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  {
    path: '/docs/:slug',
    layout: Layout,
    component: Doc,
    render: 'ssg',
    revalidate: 60,
    getStaticPaths: () => ['/docs/intro', '/docs/api'],
  },
  {
    path: '/posts/:id',
    layout: Layout,
    component: Post,
    render: 'ssr',
  },
  {
    path: '/stream',
    layout: Layout,
    component: Stream,
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
