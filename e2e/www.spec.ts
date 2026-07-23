import { test, expect } from '@playwright/test'

test('landing shows brand and docs CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toHaveText('avedon')
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute(
    'href',
    '/docs/quick-start/',
  )
})

test('docs hub loads', async ({ page }) => {
  await page.goto('/docs/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
})

test('quick start doc renders', async ({ page }) => {
  await page.goto('/docs/quick-start/')
  await expect(page.getByRole('heading', { name: 'Quick start' })).toBeVisible()
})

test('robots.txt is plain text with sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.ok()).toBeTruthy()
  expect(res.headers()['content-type'] || '').toMatch(/text\/plain/)
  const body = await res.text()
  expect(body).toContain('User-agent:')
  expect(body).toContain('Sitemap:')
  expect(body).not.toMatch(/<!doctype html>/i)
})
