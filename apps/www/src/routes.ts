import { defineRoutes, route } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import DocsIndex from './pages/DocsIndex.ave'
import Doc from './pages/Doc.ave'
import { docStaticPaths } from './lib/doc-paths'

export const routes = defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  {
    path: '/docs',
    layout: Layout,
    component: DocsIndex,
    render: 'ssg',
  },
  route('/docs/:slug', {
    layout: Layout,
    component: Doc,
    render: 'ssg',
    getStaticPaths: () => docStaticPaths(),
  }),
])
