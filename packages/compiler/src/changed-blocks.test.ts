import { describe, expect, it } from 'vitest'
import { changedBlocks, parse } from './parse.js'

const base = `
<script>const n = signal(0)</script>
<script server>export async function load() { return {} }</script>
<style>.x{}</style>
<template><p>hi</p></template>
`

describe('changedBlocks', () => {
  it('detects template-only change', () => {
    const next = base.replace('<p>hi</p>', '<p>bye</p>')
    expect([...changedBlocks(base, next)]).toEqual(['template'])
  })

  it('detects server-only change', () => {
    const next = base.replace('return {}', 'return { a: 1 }')
    expect([...changedBlocks(base, next)]).toEqual(['server'])
  })

  it('detects client script change', () => {
    const next = base.replace('signal(0)', 'signal(1)')
    expect([...changedBlocks(base, next)]).toEqual(['client'])
  })
})

describe('parse export', () => {
  it('still parses blocks', () => {
    expect(parse(base).markup).toContain('hi')
  })
})
