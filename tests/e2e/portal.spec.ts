import { expect, test } from 'playwright/test'

test('public landing and lead form render without overflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/')

  await expect(page).toHaveTitle('CMAC Container Homes | Texas-Built Modular Living')
  await expect(page.getByRole('heading', { name: 'Container Homes', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Full name')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('production login is Google-only and reports missing configuration', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/login')

  const googleButton = page.getByRole('button', { name: 'Continue with Google' })
  await expect(googleButton).toBeVisible()
  await expect(googleButton).toBeDisabled()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expect(page.getByText('Google Workspace sign-in is not configured in this environment.')).toBeVisible()
})

test('direct employee routes refresh and interactive navigation works', async ({ page }, testInfo) => {
  await page.goto('/employee-portal/leads')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lead pipeline' })).toBeVisible()

  const search = page.getByPlaceholder('Search leads')
  await search.fill('Avery')
  await expect(page.locator('.resource-row')).toHaveCount(1)
  await expect(page.getByText('Avery Brooks')).toBeVisible()

  if ((testInfo.project.use.viewport?.width ?? 1440) <= 760) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  } else {
    await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  }

  await expect(page).toHaveURL(/\/employee-portal\/inventory$/)
  await expect(page.getByText('Inventory unavailable')).toBeVisible()
  await expect(page.getByText('MODEL REFERENCE / MOCK').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('theme preference persists', async ({ page }) => {
  await page.goto('/employee-portal')

  const before = await page.locator('html').getAttribute('data-theme')
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
  const after = await page.locator('html').getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', after ?? 'light')
})

test('DocuSign surfaces an explicit coming-soon state', async ({ page }) => {
  await page.goto('/employee-portal/contracts')

  await expect(page.getByRole('heading', { name: 'Contract tracking' })).toBeVisible()
  await expect(page.getByText('DocuSign contract delivery is paused for this release')).toBeVisible()
  await expect(page.getByText('Deferred', { exact: true })).toBeVisible()
})
