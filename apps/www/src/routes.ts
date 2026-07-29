import { defineRoutes, route } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import DocsIndex from './pages/DocsIndex.ave'
import Doc from './pages/Doc.ave'
import Playground from './pages/Playground.ave'
import { docStaticPaths } from './lib/doc-paths.js'

export const routes = defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
    awaitHead: true,
  },
  {
    path: '/docs',
    layout: Layout,
    component: DocsIndex,
    render: 'ssg',
    awaitHead: true,
  },
  {
    path: '/playground',
    layout: Layout,
    component: Playground,
    render: 'ssg',
    awaitHead: true,
  },
  route('/docs/:slug', {
    layout: Layout,
    component: Doc,
    render: 'ssg',
    getStaticPaths: () => docStaticPaths(),
    awaitHead: true,
  }),
])
