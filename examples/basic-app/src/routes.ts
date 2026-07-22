import { defineRoutes, route, requireSession } from '@avedon/server'
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
import IsrLab from './pages/IsrLab.ave'
import StreamTtfbLab from './pages/StreamTtfbLab.ave'
import StreamRedirectLab from './pages/StreamRedirectLab.ave'
import StreamErrorLab from './pages/StreamErrorLab.ave'
import Login from './pages/Login.ave'
import RouteNotFound from './pages/errors/RouteNotFound.ave'
import RouteError from './pages/errors/RouteError.ave'

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
  route('/posts/:id', {
    layout: Layout,
    component: Post,
    render: 'ssr',
  }),
  {
    path: '/stream',
    layout: Layout,
    component: Stream,
    render: 'ssr',
  },
  {
    path: '/stream-ttfb/stream',
    layout: Layout,
    component: StreamTtfbLab,
    render: 'ssr',
  },
  {
    path: '/stream-redirect/:mode',
    layout: Layout,
    component: StreamRedirectLab,
    render: 'ssr',
    notFound: RouteNotFound,
  },
  {
    path: '/stream-ttfb/buffer',
    layout: Layout,
    component: StreamTtfbLab,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/isr-lab',
    layout: Layout,
    component: IsrLab,
    render: 'ssg',
    revalidate: 1,
    getStaticPaths: () => ['/isr-lab'],
  },
  {
    path: '/stream-error/slow',
    layout: Layout,
    component: StreamErrorLab,
    notFound: RouteNotFound,
    render: 'ssr',
  },
  {
    path: '/login',
    layout: Layout,
    component: Login,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireSession(),
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
