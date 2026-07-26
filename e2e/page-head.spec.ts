import { test, expect } from '@playwright/test'

test('route load provides a per-page title in the SSR response', async ({ page }) => {
  const res = await page.goto('/posts/1')
  const html = await res!.text()
  expect(html).toContain('<title>Hello avedon — avedon</title>')
  expect(html).not.toContain('<title>avedon example</title>')
  expect(html).toContain('content="Post 1 on the avedon example app."')
  await expect(page).toHaveTitle('Hello avedon — avedon')
})

test('client navigation picks up the per-page title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('avedon example')
  await page.click('a[href="/posts/1"]')
  await expect(page).toHaveTitle('Hello avedon — avedon')
})
