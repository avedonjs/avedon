import { test, expect } from '@playwright/test'

test('component renders in SSR and is interactive after hydration', async ({ page }) => {
  const res = await page.goto('/')
  const html = await res!.text()
  // SSR: the component markup is present in the first response (not created client-only)
  expect(html).toContain('data-testid="counter"')
  expect(html).toContain('>3<')

  const output = page.getByTestId('counter').locator('output')
  await expect(output).toHaveText('3')
  await page.getByTestId('counter').getByRole('button', { name: '+' }).click()
  await expect(output).toHaveText('4')
})
