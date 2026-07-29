export type PresetCategory =
  | 'Basics'
  | 'Reactivity'
  | 'Forms'
  | 'Directives'
  | 'Components'
  | 'Server'

export type PlaygroundPreset = {
  id: string
  title: string
  category: PresetCategory
  description: string
  source: string
}
