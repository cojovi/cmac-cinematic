import { expect, test, type Page } from 'playwright/test'
import { portalFixtures } from '../../src/lib/portal-fixtures'

// Local preview keeps every write in memory, so these flows exercise the real
// components end to end without a database. A page load resets the sample data.

const column = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^${name}, `) })
const noOverflow = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

test('a lead moves across the board by menu, and closing it asks for a reason', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/employee-portal/leads')
  await expect(column(page, 'New').locator('.crm-kanban-card')).toHaveCount(3)

  await page.getByRole('combobox', { name: 'Move Avery Brooks' }).selectOption('contacted')
  await expect(page.getByText('Avery Brooks moved to Contacted.')).toBeVisible()
  await expect(column(page, 'Contacted').getByRole('link', { name: 'Avery Brooks', exact: true })).toBeVisible()
  await expect(column(page, 'New').locator('.crm-kanban-card')).toHaveCount(2)

  await page.getByRole('combobox', { name: 'Move Blake Turner' }).selectOption('lost')
  const dialog = page.getByRole('dialog', { name: 'Mark Blake Turner lost?' })
  await dialog.getByLabel('Why was it lost?').fill('Went with a competitor')
  await dialog.getByRole('button', { name: 'Mark lost' }).click()
  await expect(page.getByText('Blake Turner moved to Lost.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Blake Turner', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(page).toHaveURL(/view=table/)
  await page.getByRole('button', { name: /^Lost/ }).click()
  await expect(page.locator('.crm-table tbody tr')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Blake Turner', exact: true })).toBeVisible()
  await noOverflow(page)
  expect(errors).toEqual([])
})

test('dragging a card to another column changes its stage', async ({ page }, testInfo) => {
  // Below this width the board scrolls sideways, and the automated drag cannot scroll mid-gesture. The Move menu is the tested path there.
  test.skip((testInfo.project.use.viewport?.width ?? 1440) < 1440, 'Drag and drop is verified where all four columns are on screen.')
  await page.goto('/employee-portal/leads')
  await page.locator('.crm-kanban-card', { hasText: 'Casey Whitfield' }).dragTo(column(page, 'Qualified'))
  await expect(page.getByText('Casey Whitfield moved to Qualified.')).toBeVisible()
  await expect(column(page, 'Qualified').getByRole('link', { name: 'Casey Whitfield', exact: true })).toBeVisible()
  await expect(column(page, 'Contacted').locator('.crm-kanban-card')).toHaveCount(0)
})

test('focus filters, bulk stage moves, and CSV export work from the table', async ({ page }) => {
  await page.goto('/employee-portal/leads?view=table')
  await page.getByRole('button', { name: /Needs first contact/ }).click()
  await expect(page.locator('.crm-table tbody tr')).toHaveCount(3)
  await page.getByRole('checkbox', { name: 'Select all leads shown' }).check()
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('3 selected')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export selected' }).click()
  expect((await download).suggestedFilename()).toMatch(/^cmac-leads-\d{4}-\d{2}-\d{2}\.csv$/)
  await page.getByRole('combobox', { name: 'Move selected leads to a stage' }).selectOption('contacted')
  // Moved leads are no longer "new", so they leave the first-contact filter.
  await expect(page.getByText('No leads match these filters')).toBeVisible()
  await page.getByRole('button', { name: /Needs first contact/ }).click()
  await page.getByRole('button', { name: /^Contacted/ }).click()
  await expect(page.locator('.crm-table tbody tr')).toHaveCount(4)
  await noOverflow(page)
})

test('logging a call books the next step, and the follow-up can be completed', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/employee-portal/leads/preview-lead-9')
  await expect(page.getByRole('heading', { name: 'Blake Turner', level: 2 })).toBeVisible()
  await expect(page.getByText('No next step booked')).toBeVisible()

  await page.getByRole('tab', { name: 'Call' }).click()
  await page.getByLabel('Outcome').selectOption('Left voicemail')
  await page.getByRole('textbox', { name: 'Details' }).fill('Left pricing overview and asked for a callback.')
  await page.getByRole('combobox', { name: 'Schedule a follow-up' }).selectOption('tomorrow')
  await page.getByRole('button', { name: 'Save call' }).click()
  await expect(page.getByText('Call saved and follow-up scheduled.')).toBeVisible()
  await expect(page.locator('.crm-timeline')).toContainText('Call logged · Left voicemail')
  await expect(page.locator('.crm-timeline')).toContainText('Left pricing overview and asked for a callback.')
  const task = page.locator('.crm-task', { hasText: 'Follow up with Blake Turner' })
  await expect(task).toContainText(/Tomorrow 9:00 AM/)

  await page.getByRole('button', { name: 'Calls & messages' }).click()
  await expect(page.locator('.crm-timeline li')).toHaveCount(1)
  await page.getByRole('button', { name: 'Everything' }).click()

  await task.getByRole('button', { name: 'Complete Follow up with Blake Turner' }).click()
  await expect(page.getByText('Follow-up completed.')).toBeVisible()
  await expect(page.locator('.crm-task.closed', { hasText: 'Follow up with Blake Turner' })).toBeVisible()

  // The stage stepper moves the lead forward from the record itself.
  await page.getByRole('button', { name: /^Contacted/ }).click()
  await expect(page.getByText('Blake Turner moved to Contacted.')).toBeVisible()
  await expect(page.locator('.crm-stepper li.current')).toContainText('Contacted')
  await noOverflow(page)
  expect(errors).toEqual([])
})

test('the follow-up queue groups work by urgency and supports create, snooze, and cancel', async ({ page }) => {
  await page.goto('/employee-portal/tasks?owner=all')
  await expect(page.locator('.crm-bucket.overdue .crm-task')).toHaveCount(2)
  await expect(page.locator('.crm-bucket.overdue .crm-task').first()).toContainText('Review Taylor site photos')

  await page.getByRole('combobox', { name: 'Reschedule Review Taylor site photos' }).selectOption('tomorrow')
  await expect(page.getByText('Follow-up rescheduled.')).toBeVisible()
  await expect(page.locator('.crm-bucket.overdue .crm-task')).toHaveCount(1)
  await expect(page.locator('.crm-bucket.tomorrow')).toContainText('Review Taylor site photos')

  await page.getByRole('button', { name: 'New follow-up' }).click()
  const dialog = page.getByRole('dialog', { name: 'Schedule a follow-up' })
  await dialog.getByLabel('What needs to happen?').fill('Order sample finish board')
  await dialog.getByLabel('Priority').selectOption('urgent')
  await dialog.getByRole('button', { name: 'In 2 hours' }).click()
  await dialog.getByRole('button', { name: 'Schedule follow-up' }).click()
  await expect(page.getByText('Follow-up scheduled.')).toBeVisible()
  await expect(page).not.toHaveURL(/new=1/)
  await page.getByLabel('Assigned employee').selectOption('mine')
  const created = page.locator('.crm-task', { hasText: 'Order sample finish board' })
  await expect(created).toContainText('urgent')

  await created.getByRole('button', { name: 'Cancel Order sample finish board' }).click()
  await page.getByRole('dialog', { name: 'Cancel this follow-up?' }).getByRole('button', { name: 'Cancel follow-up' }).click()
  await expect(page.getByText('Follow-up cancelled.')).toBeVisible()
  await expect(page.locator('.crm-task', { hasText: 'Order sample finish board' })).toHaveCount(0)
  await page.getByRole('button', { name: /Show closed/ }).click()
  await expect(page.locator('.crm-task.closed', { hasText: 'Order sample finish board' })).toBeVisible()
  await noOverflow(page)
})

test('a customer can be created, edited, and searched from the command palette', async ({ page }) => {
  await page.goto('/employee-portal/customers')
  await page.getByRole('button', { name: 'Add customer' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a customer' })
  await dialog.getByLabel('First name *').fill('Dana')
  await dialog.getByLabel('Last name').fill('Whitaker')
  await dialog.getByLabel('Email *').fill('taylor@example.com')
  await dialog.getByRole('button', { name: 'Create customer' }).click()
  await expect(page.getByText('A contact with that email already exists.')).toBeVisible()
  await dialog.getByLabel('Email *').fill('dana.whitaker@example.com')
  await dialog.getByLabel('Phone').fill('(817) 555-0142')
  await dialog.getByRole('button', { name: 'Create customer' }).click()
  await expect(page.getByRole('heading', { name: 'Dana Whitaker', level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Edit details' }).click()
  const drawer = page.getByRole('dialog', { name: 'Edit Dana Whitaker' })
  await drawer.getByLabel('Company').fill('Whitaker Ranch')
  await drawer.getByLabel('Lifecycle').selectOption('prospect')
  await drawer.getByRole('button', { name: 'Save details' }).click()
  await expect(page.getByText('Customer details saved.')).toBeVisible()
  await expect(page.locator('.record-fields')).toContainText('Whitaker Ranch')

  await page.getByRole('button', { name: 'Search the CRM' }).click()
  const palette = page.getByRole('dialog', { name: 'Search the CRM' })
  await palette.getByRole('combobox').fill('meridian')
  await expect(palette.getByRole('option').first()).toContainText('Meridian Workforce LLC')
  await palette.getByRole('combobox').press('Enter')
  await expect(page.getByRole('heading', { name: 'Meridian Workforce LLC', level: 2 })).toBeVisible()
  await expect(page.getByRole('link', { name: /CM-2026-0039/ })).toBeVisible()
  await noOverflow(page)
})

test('a deal advances, gets a quote with edited lines, and the quote locks once sent', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/employee-portal/deals')
  await expect(page.locator('.crm-metric').first()).toContainText('$318,500')
  await page.getByRole('combobox', { name: 'Move CM-2026-0044' }).selectOption('quote')
  await expect(page.getByText('CM-2026-0044 moved to Quote.')).toBeVisible()
  await expect(column(page, 'Quote').locator('.crm-kanban-card')).toHaveCount(2)

  await page.getByRole('link', { name: 'CM-2026-0044' }).click()
  await expect(page.getByRole('heading', { name: 'Meridian Phase 2', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark sold' })).toBeDisabled()
  await page.getByRole('button', { name: 'New quote' }).click()
  await expect(page).toHaveURL(/\/employee-portal\/quotes\//)
  await expect(page.locator('.crm-totals .grand')).toContainText('$106,000.00')

  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByLabel('Line 2 description').fill('Covered porch package')
  await page.getByLabel('Line 2 quantity').fill('2')
  await page.getByLabel('Line 2 unit price').fill('4500')
  await expect(page.locator('.crm-totals .grand')).toContainText('$115,000.00')
  await expect(page.getByText('Unsaved changes.')).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Quote saved.')).toBeVisible()
  await expect(page.getByLabel('Line 2 description')).toHaveValue('Covered porch package')

  await page.getByRole('button', { name: 'Mark sent' }).click()
  await expect(page.getByText('Quote marked sent.')).toBeVisible()
  await expect(page.getByLabel('Line 1 description')).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: 'Add line' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Accepted' })).toBeVisible()
  await noOverflow(page)
  expect(errors).toEqual([])
})

test('a deal can only be marked sold with confirmed units, then becomes a permanent sale', async ({ page }) => {
  await page.goto('/employee-portal/deals/preview-deal-1')
  await expect(page.getByText('Every unit needs a confirmed, non-model reference.')).toBeVisible()
  await page.getByLabel('Real unit or job ID').fill('CMH-3004')
  await page.getByRole('button', { name: 'Confirm unit' }).click()
  await expect(page.getByText('Unit added and confirmed.')).toBeVisible()
  await page.getByRole('button', { name: 'Remove unit MODEL-LIVING-40' }).click()
  await expect(page.getByText('Enter the override reason to continue.')).toBeVisible()
  await page.getByLabel('Admin override reason').fill('Signed paper contract on file.')
  await page.getByRole('button', { name: 'Mark sold' }).click()
  await page.getByRole('dialog', { name: 'Mark CM-2026-0042 sold?' }).getByRole('button', { name: 'Mark sold' }).click()
  await expect(page.getByText('Deal marked sold. 1 unit sale record(s) created.')).toBeVisible()
  await expect(page.getByText('Unit attribution is permanent.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit deal' })).toHaveCount(0)
  await page.goto('/employee-portal/reports')
  await expect(page.getByRole('heading', { name: 'Results by lead source' })).toBeVisible()
  await expect(page.getByRole('img', { name: /New leads per week/ })).toBeVisible()
  await noOverflow(page)
})

test('in production a representative’s stage move goes through the audited lead function', async ({ page }) => {
  const base = portalFixtures.employees[1]
  const rep = { ...base, id: String(base.id), email: String(base.email), auth_user_id: 'b2222222-2222-4222-8222-222222222222' }
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const user = { id: rep.auth_user_id, aud: 'authenticated', email: rep.email, app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() }
  const session = { access_token: `test.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt })).toString('base64url')}.test`, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user }
  await page.addInitScript(value => localStorage.setItem('sb-crm-test-auth-token', JSON.stringify(value)), session)
  const leads = portalFixtures.leads.filter(lead => lead.assigned_employee_id === rep.id).map(lead => ({ ...lead }))
  const calls: Record<string, unknown>[] = []
  let refuse = true
  await page.route('https://crm-test.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname === '/auth/v1/settings') data = { external: { google: true } }
    else if (url.pathname === '/auth/v1/user') data = user
    else if (url.pathname === '/rest/v1/employees') data = url.searchParams.has('auth_user_id') ? rep : [rep]
    else if (url.pathname === '/rest/v1/leads') data = leads
    else if (url.pathname === '/functions/v1/manage-lead') {
      const body = route.request().postDataJSON() as { action: string; lead_id: string; lead: { status: string } }
      calls.push(body)
      if (refuse) { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'You can only change leads assigned to you' }) }); return }
      const lead = leads.find(item => item.id === body.lead_id)
      if (lead) lead.status = body.lead.status
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lead_id: body.lead_id, status: body.lead.status, message: 'Lead status updated.' }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('http://127.0.0.1:4174/employee-portal/leads')
  await expect(page.getByRole('heading', { name: 'Lead pipeline', level: 2 })).toBeVisible()
  // Representatives get no owner filter and no archive option.
  await expect(page.getByLabel('Assigned employee')).toHaveCount(0)
  const move = page.getByRole('combobox', { name: 'Move Avery Brooks' })
  await expect(move.locator('option')).toHaveText(['Move…', 'Contacted', 'Nurturing', 'Qualified', 'Lost', 'Convert to deal'])

  await move.selectOption('contacted')
  await expect(page.getByText('You can only change leads assigned to you')).toBeVisible()
  await expect(column(page, 'New').getByRole('link', { name: 'Avery Brooks', exact: true })).toBeVisible()

  refuse = false
  await move.selectOption('contacted')
  await expect(page.getByText('Avery Brooks moved to Contacted.')).toBeVisible()
  await expect(column(page, 'Contacted').getByRole('link', { name: 'Avery Brooks', exact: true })).toBeVisible()
  expect(calls).toHaveLength(2)
  expect(calls[1]).toMatchObject({ action: 'set_status', lead_id: 'preview-lead-2', lead: { status: 'contacted' } })
  expect(calls[1]).not.toHaveProperty('actor_employee_id')
})
