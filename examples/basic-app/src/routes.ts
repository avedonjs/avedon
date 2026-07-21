import { defineRoutes } from '@avedon/server'
import Layout from './pages/Layout.avedon'
import Home from './pages/Home.avedon'
import Post from './pages/Post.avedon'
import Admin from './pages/Admin.avedon'
import AdminError from './pages/AdminError.avedon'
import Doc from './pages/Doc.avedon'
import Stream from './pages/Stream.avedon'
import ErrorLabNf from './pages/ErrorLabNf.avedon'
import ErrorLabBoom from './pages/ErrorLabBoom.avedon'
import ErrorLabPlainNf from './pages/ErrorLabPlainNf.avedon'
import ErrorLabNestedBoom from './pages/ErrorLabNestedBoom.avedon'
import ErrorLabParent from './pages/ErrorLabParent.avedon'
import RouteNotFound from './pages/errors/RouteNotFound.avedon'
import RouteError from './pages/errors/RouteError.avedon'
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
  {
    path: '/error-lab/nf',
    layout: Layout,
    component: ErrorLabNf,
    notFound: RouteNotFound,
    render: 'ssr',
  },
  {
    path: '/error-lab/boom',
    layout: Layout,
    component: ErrorLabBoom,
    error: RouteError,
    render: 'ssr',
  },
  {
    path: '/error-lab/global-nf',
    layout: Layout,
    component: ErrorLabPlainNf,
    render: 'ssr',
  },
  {
    path: '/error-lab',
    component: ErrorLabParent,
    error: RouteError,
    children: [
      {
        path: 'nested-boom',
        layout: Layout,
        component: ErrorLabNestedBoom,
        render: 'ssr',
      },
    ],
  },
])

export default routes
export { routes }
