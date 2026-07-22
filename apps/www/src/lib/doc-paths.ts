/** Keep in sync with `docs/manifest.json` groups[].slugs (flattened). */
export const DOC_SLUGS = [
  'introduction',
  'quick-start',
  'project-structure',
  'cli',
  'tutorial',
  'components',
  'routing',
  'loading-data',
  'rendering',
  'reactivity',
  'middleware',
  'session',
  'security',
  'configuration',
  'deployment',
] as const

export function docStaticPaths(): string[] {
  return DOC_SLUGS.map((slug) => `/docs/${slug}`)
}
