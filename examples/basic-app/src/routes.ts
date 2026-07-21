import { defineRoutes } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import Post from './pages/Post.ave'
import Admin from './pages/Admin.ave'
import AdminError from './pages/AdminError.ave'
import Doc from './pages/Doc.ave'
import Stream from './pages/Stream.ave'
import ErrorLabNf from './pages/ErrorLabNf.ave'
import ErrorLabBoom from './pages/ErrorLabBoom.ave'
import ErrorLabPlainNf from './pages/ErrorLabPlainNf.ave'
import ErrorLabNestedBoom from './pages/ErrorLabNestedBoom.ave'
import ErrorLabParent from './pages/ErrorLabParent.ave'
import RouteNotFound from './pages/errors/RouteNotFound.ave'
import RouteError from './pages/errors/RouteError.ave'
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
