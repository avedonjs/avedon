import { test, expect } from '@playwright/test'

test('home ssg/ssr renders brand', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('vexjs')
})

test('post ssr + client like button', async ({ page }) => {
  await page.goto('/posts/1')
  await expect(page.locator('h1')).toHaveText('Hello vexjs')
  const btn = page.getByRole('button', { name: /Optimistic/ })
  const before = await btn.textContent()
  await btn.click()
  await expect(btn).not.toHaveText(before || '')
})

test('client nav does not full-reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __navMarker: number }).__navMarker = 1
  })
  await page.click('a[href="/posts/1"]')
  await expect(page.locator('h1')).toHaveText('Hello vexjs')
  const marker = await page.evaluate(
    () => (window as unknown as { __navMarker?: number }).__navMarker,
  )
  expect(marker).toBe(1)
})

test('form action like updates page', async ({ page }) => {
  await page.goto('/posts/1')
  await page.getByRole('button', { name: 'Like (server action)' }).click()
  await expect(page.locator('h1')).toHaveText('Hello vexjs')
})

test('admin guard blocks unauthorized', async ({ request }) => {
  const res = await request.get('/admin')
  expect(res.status()).toBe(403)
})

test('api_GET via .json', async ({ request }) => {
  const res = await request.get('/posts/1.json')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.post.id).toBe('1')
})
