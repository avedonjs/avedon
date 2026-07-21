import { createRenderStream, streamToString, type RenderStreamController } from '@avedon/runtime'
import { matchRoute } from './match.js'
import { createCookies } from './cookies.js'
import {
  renderShellPrefix,
  renderShellSuffixFromTemplate,
  resolveComponent,
} from './ssr.js'
import type { Routes, AvedonComponentModule } from './types.js'

export type SsgPage = { path: string; html: string }

export type RenderSsgOptions = {
  clientEntry?: string
}

/** Render a single SSG pathname to HTML (build + ISR regen). */
export async function renderSsgPage(
  routes: Routes,
  pagePath: string,
  appHtml: string,
  options: RenderSsgOptions = {},
): Promise<SsgPage | null> {
  const matched = matchRoute(routes, pagePath)
  if (!matched) return null
  const leaf = matched.route
  if ((leaf.render ?? 'ssr') !== 'ssg') return null

  const chain = matched.chain
  const mod = await resolveComponent(leaf.component)
  const params = matched.params
  let data: Record<string, unknown> = {}
  if (mod.load) {
    const url = new URL(pagePath, 'http://ssg.local')
    const request = new Request(url)
    const cookies = createCookies(request, url)
    const loaded = await mod.load({
      params,
      request,
      url,
      cookies,
    })
    if (loaded && !(loaded instanceof Response)) data = loaded
  }

  const cssParts: string[] = []
  if (mod.css) cssParts.push(mod.css)

  const layouts: AvedonComponentModule[] = []
  for (let i = chain.length - 1; i >= 0; i--) {
    const r = chain[i]
    if (!r.layout) continue
    const layout = await resolveComponent(r.layout)
    layouts.push(layout)
    if (layout.css) cssParts.push(layout.css)
  }

  let writeBody: (ctrl: RenderStreamController) => Promise<void> = async (ctrl) => {
    ctrl.enqueueHtml('<div data-avedon-page>')
    await writeComponent(mod, data, ctrl)
    ctrl.enqueueHtml('</div>')
  }
  for (const layout of layouts) {
    const inner = writeBody
    writeBody = async (ctrl) => {
      await writeComponent(layout, { ...data, children: inner }, ctrl)
    }
  }

  const clientEntry = options.clientEntry ?? '/assets/client.js'
  const ctrl = createRenderStream()
  const htmlP = streamToString(ctrl.stream)
  ctrl.enqueueHtml(renderShellPrefix(appHtml, { css: cssParts.filter(Boolean).join('\n') }))
  await writeBody(ctrl)
  await ctrl.waitPending()
  ctrl.enqueueHtml(
    renderShellSuffixFromTemplate(appHtml, {
      props: data,
      clientEntry,
    }),
  )
  ctrl.close()
  return { path: pagePath, html: await htmlP }
}

/** Expand SSG routes (including `getStaticPaths` / `entries`) into HTML pages. */
export async function buildSsgPages(routes: Routes, appHtml: string): Promise<SsgPage[]> {
  const ssgPages: SsgPage[] = []
  for (const route of flattenRoutes(routes)) {
    if ((route.render ?? 'ssr') !== 'ssg') continue
    const listFn = route.getStaticPaths ?? route.entries
    const paths = listFn != null ? await listFn() : [route.path.includes(':') ? null : route.path]
    for (const p of paths) {
      if (!p) continue
      const page = await renderSsgPage(routes, p, appHtml)
      if (page) ssgPages.push(page)
    }
  }
  return ssgPages
}

async function writeComponent(
  component: AvedonComponentModule,
  props: Record<string, unknown>,
  ctrl: RenderStreamController,
): Promise<void> {
  if (typeof component.renderInto === 'function') {
    await component.renderInto(ctrl, props)
    return
  }
  let propsForRender = props
  if (typeof props.children === 'function') {
    const childCtrl = createRenderStream()
    const htmlP = streamToString(childCtrl.stream)
    await (props.children as (c: RenderStreamController) => Promise<void>)(childCtrl)
    await childCtrl.waitPending()
    childCtrl.close()
    propsForRender = { ...props, children: await htmlP }
  }
  if (typeof component.renderToStream === 'function') {
    await ctrl.pipeChildren(component.renderToStream(propsForRender))
    return
  }
  ctrl.enqueueHtml(component.render(propsForRender))
}

export function flattenRoutes(routes: Routes): Routes {
  const out: Routes = []
  for (const r of routes) {
    out.push(r)
    if (r.children) out.push(...flattenRoutes(r.children))
  }
  return out
}
