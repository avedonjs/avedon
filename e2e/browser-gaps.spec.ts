import { test, expect } from '@playwright/test'

test('login form establishes session and opens admin CSR', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/?$/)
  await expect(page.getByRole('heading', { name: 'Admin (CSR)' })).toBeVisible()
  await expect(page.locator('[data-avedon-csr]')).toBeVisible()
})

test('form action without Origin/Referer is rejected (CSRF)', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    // Intentionally omit origin / referer
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {},
  })
  expect(res.status()).toBe(403)
})

test('form action with matching Origin succeeds', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    headers: { origin: 'http://localhost:5173' },
    form: {},
  })
  expect(res.status()).toBeLessThan(400)
  const html = await res.text()
  expect(html).toContain('Hello avedon')
})

test('slow stream redirect completes via client navigation', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/stream-redirect/slow', { waitUntil: 'commit' })
  await page.waitForURL(/stream-redirect=ok/, { timeout: 20_000 })
  await expect(page.locator('.brand, [data-starter-stage] .brand')).toContainText('avedon')
})

test('home signal increment updates without full reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __sigMarker: number }).__sigMarker = 1
  })
  const count = page.locator('.demo-count')
  await expect(count).toHaveText('0')
  await page.getByRole('button', { name: 'Increment' }).click()
  await expect(count).toHaveText('1')
  const marker = await page.evaluate(
    () => (window as unknown as { __sigMarker?: number }).__sigMarker,
  )
  expect(marker).toBe(1)
})
