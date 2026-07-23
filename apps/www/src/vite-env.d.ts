/// <reference types="vite/client" />

/**
 * Fallback when sibling `*.ave.d.ts` files are absent.
 * Those siblings are gitignored and written by `@avedon/vite-plugin` during
 * build/dev; CI typecheck needs this ambient module so `.ave` imports resolve.
 */
declare module '*.ave' {
  export interface Props {
    [key: string]: unknown
  }
  export function render(props?: Props): string
  export function renderInto(
    ctrl: import('@avedon/runtime').RenderStreamController,
    props?: Props,
  ): Promise<void>
  export function renderToStream(props?: Props): ReadableStream<Uint8Array>
  export function mount(
    target: Element,
    props?: Props,
  ): { destroy(): void; update(props: Props): void }
  export function hydrate(
    target: Element,
    props?: Props,
  ): { destroy(): void; update(props: Props): void }
  export const css: string
  export const cssHash: string
  const __default: {
    render: typeof render
    renderInto?: typeof renderInto
    renderToStream?: typeof renderToStream
    mount?: typeof mount
    hydrate?: typeof hydrate
    css: string
    cssHash: string
    load?: (
      event: import('@avedon/shared').LoadContext<Record<string, string>>,
    ) => import('@avedon/shared').LoadResult | Promise<import('@avedon/shared').LoadResult>
    actions?: Record<string, import('@avedon/shared').ActionHandler<Record<string, string>>>
    api?: Record<string, import('@avedon/shared').ApiHandler<Record<string, string>>>
  }
  export default __default
}
