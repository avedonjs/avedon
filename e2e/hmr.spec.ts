import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../examples/basic-app')
const postVex = path.join(root, 'src/pages/Post.vex')

test('HMR preserves signal state on template edit (no full reload)', async ({ page }) => {
  const original = fs.readFileSync(postVex, 'utf8')
  test.setTimeout(90_000)

  try {
    await page.goto('/posts/1')
    await expect(page.locator('h1')).toHaveText('Hello vexjs')

    await page.evaluate(() => {
      ;(window as unknown as { __hmrMarker: number }).__hmrMarker = 42
    })

    const likesEl = page.locator('text=Likes:')
    const before = await likesEl.textContent()
    const beforeN = Number((before || '').replace(/\D/g, '')) || 0

    const btn = page.getByRole('button', { name: /Optimistic/ })
    await btn.click()
    await btn.click()
    const afterClicks = beforeN + 2
    await expect(likesEl).toContainText(String(afterClicks))

    // Template-only edit (not server script)
    const edited = original.replace(
      '<h1 class="title">{data.post.title}</h1>',
      '<h1 class="title" data-hmr="1">{data.post.title}</h1>',
    )
    expect(edited).not.toBe(original)
    fs.writeFileSync(postVex, edited)

    await page.waitForFunction(
      () => document.querySelector('h1[data-hmr="1"]') != null,
      null,
      { timeout: 15_000 },
    )

    const marker = await page.evaluate(
      () => (window as unknown as { __hmrMarker?: number }).__hmrMarker,
    )
    expect(marker).toBe(42)

    // Signal state preserved across HMR remount
    await expect(likesEl).toContainText(String(afterClicks))
  } finally {
    fs.writeFileSync(postVex, original)
  }
})

test('server script edit still triggers full reload', async ({ page }) => {
  const original = fs.readFileSync(postVex, 'utf8')
  test.setTimeout(90_000)

  try {
    await page.goto('/posts/1')
    await page.evaluate(() => {
      ;(window as unknown as { __hmrMarker: number }).__hmrMarker = 7
    })

    const serverEdited = original.replace(
      '// params.id is typed as string via LoadEvent<\'/posts/:id\'>',
      '// params.id is typed as string via LoadEvent<\'/posts/:id\'> /* hmr-server */',
    )
    expect(serverEdited).not.toBe(original)
    fs.writeFileSync(postVex, serverEdited)

    // Full reload clears window marker
    await page.waitForFunction(
      () => (window as unknown as { __hmrMarker?: number }).__hmrMarker !== 7,
      null,
      { timeout: 15_000 },
    )
  } finally {
    fs.writeFileSync(postVex, original)
  }
})
