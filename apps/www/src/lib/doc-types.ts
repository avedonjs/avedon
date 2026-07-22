export type DocHeading = { id: string; text: string; level: 2 | 3 }
export type DocEntry = {
  slug: string
  title: string
  blurb: string
  html: string
  headings: DocHeading[]
}
export type DocGroup = {
  id: string
  title: string
  slugs: string[]
}
export type DocsFile = {
  groups: DocGroup[]
  docs: DocEntry[]
}
