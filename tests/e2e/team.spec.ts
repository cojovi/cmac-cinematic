import { expect, test } from 'playwright/test'
import { portalFixtures } from '../../src/lib/portal-fixtures'
import { fixtureTeam } from '../../src/lib/team-management'

const repId = '22222222-2222-4222-8222-222222222222'

test('admin can inspect rep ownership and activity, then open named customer records', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/employee-portal/admin/employees')
  await page.getByRole('button', { name: /Demo Sales Rep/ }).click()
  await expect(page).toHaveURL(new RegExp(`employee=${repId}`))
  await expect(page.getByRole('heading', { name: 'Demo Sales Rep · Activity' })).toBeVisible()
  await expect(page.locator('.team-activity-feed').getByText('New website inquiry')).toHaveCount(0)
  await page.locator('summary').filter({ hasText: 'Manage Demo Sales Rep' }).click()
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('admin')
  await page.getByRole('button', { name: 'Save employee' }).click()
  await expect(page.getByText('Local preview only — no employee access was changed.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.team-assignment-links').getByRole('link', { name: /Customers/ }).click()
  await expect(page.getByLabel('Assigned employee')).toHaveValue(repId)
  await expect(page.locator('.resource-row')).toHaveCount(2)
  await page.getByRole('link', { name: /Taylor Morgan/ }).click()
  const fields = page.locator('.record-fields')
  await expect(fields.getByRole('link', { name: 'Demo Sales Rep' })).toBeVisible()
  await expect(fields.getByRole('link', { name: 'Morgan Admin' })).toBeVisible()
  await expect(fields).not.toContainText(repId)
  await expect(fields).not.toContainText('assigned employee id')
  await page.getByRole('combobox', { name: 'New owner', exact: true }).selectOption('11111111-1111-4111-8111-111111111111')
  await page.getByRole('button', { name: 'Transfer customer & open work' }).click()
  await expect(page.getByText('Local preview only — no customer ownership was changed.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  if (test.info().project.name === 'desktop-1440') await page.screenshot({ path: '/private/tmp/cmac-customer-management-desktop.png', fullPage: true })
})

test('employee selection and unassigned filters survive refresh; self-access is protected', async ({ page }) => {
  await page.goto('/employee-portal/admin/employees?employee=11111111-1111-4111-8111-111111111111')
  await page.reload()
  await page.locator('summary').filter({ hasText: 'Manage Morgan Admin' }).click()
  await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Deactivate access' })).toBeDisabled()
  await page.getByRole('button', { name: 'All team activity' }).click()
  await expect(page.getByRole('heading', { name: 'Team activity' })).toBeVisible()
  await expect(page.locator('.team-activity-feed').getByText('System / website')).toBeVisible()
  if (test.info().project.name === 'desktop-1440') await page.screenshot({ path: '/private/tmp/cmac-team-management-desktop.png', fullPage: true })
  if (test.info().project.name === 'mobile-375') await page.screenshot({ path: '/private/tmp/cmac-team-management-mobile.png', fullPage: true })
  await page.goto('/employee-portal/customers?owner=unassigned')
  await expect(page.getByLabel('Assigned employee')).toHaveValue('unassigned')
  await expect(page.getByText('No records match the current filters.')).toBeVisible()
})

test('production admin mutation reports real errors and retries; reps cannot enter admin routes', async ({ page }) => {
  const admin = { ...portalFixtures.employees[0], email: String(portalFixtures.employees[0].email), auth_user_id: 'a1111111-1111-4111-8111-111111111111' }
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const user = { id: admin.auth_user_id, aud: 'authenticated', email: admin.email, app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() }
  const session = { access_token: `test.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt })).toString('base64url')}.test`, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user }
  await page.addInitScript(session => localStorage.setItem('sb-crm-test-auth-token', JSON.stringify(session)), session)
  let fails = true
  let isRep = false
  const mutations: Record<string, unknown>[] = []
  await page.route('https://crm-test.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname === '/auth/v1/settings') data = { external: { google: true } }
    else if (url.pathname === '/auth/v1/user') data = user
    else if (url.pathname === '/rest/v1/employees') data = url.searchParams.has('auth_user_id') ? { ...admin, role: isRep ? 'sales_rep' : 'admin' } : portalFixtures.employees
    else if (url.pathname === '/rest/v1/rpc/admin_team_overview') data = fixtureTeam(portalFixtures)
    else if (url.pathname === '/rest/v1/activities') data = []
    else if (url.pathname === '/functions/v1/admin-manage-employee') {
      mutations.push(route.request().postDataJSON())
      await route.fulfill({ status: fails ? 422 : 200, contentType: 'application/json', body: JSON.stringify(fails ? { error: 'Test conflict: please retry.' } : { message: 'Employee access updated.' }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto(`http://127.0.0.1:4174/employee-portal/admin/employees?employee=${repId}`)
  await page.locator('summary').filter({ hasText: 'Manage Demo Sales Rep' }).click()
  await page.getByLabel('First name', { exact: true }).first().fill('Updated')
  await page.getByRole('button', { name: 'Save employee' }).click()
  await expect(page.getByText('Test conflict: please retry.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save employee' })).toBeEnabled()
  fails = false
  await page.getByRole('button', { name: 'Save employee' }).click()
  await expect(page.getByText('Employee access updated.')).toBeVisible()
  expect(mutations).toHaveLength(2)
  expect(mutations[0]).toMatchObject({ action: 'update', employee_id: repId })
  expect(mutations[0]).not.toHaveProperty('actor_employee_id')
  isRep = true
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save employee' })).toHaveCount(0)
})
