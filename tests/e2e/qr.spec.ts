import { expect, test, type Page } from 'playwright/test'
import { portalFixtures } from '../../src/lib/portal-fixtures'

const answers = { name:'Jamie Sample',email:'jamie@example.com',phone:'6825550100',location:'Burleson, Texas',timing:'Immediately',units:'1-4 units',use:'Short-term rental',payment:'Financing',credit:'No' }
const row = { ...answers,id:'20000000-0000-4000-8000-000000000001',created_at:'2026-09-23T12:00:00Z',email_status:'failed',sent_at:null,email_error:'Gmail authorization unavailable.',attempts:1 }
const report = { visits:20,submissions:2,sent:1,attention:1,converted_visits:2,rows:[row],generated_at:'2026-09-23T12:00:00Z' }
async function mockAuth(page: Page, role = 'admin') {
  const admin = {...portalFixtures.employees[0],email:String(portalFixtures.employees[0].email),role,auth_user_id:'a1111111-1111-4111-8111-111111111111'}
  const expires_at = Math.floor(Date.now()/1000)+3600
  const user = {id:admin.auth_user_id,aud:'authenticated',email:admin.email,app_metadata:{provider:'google'},user_metadata:{},created_at:new Date().toISOString()}
  const session = {access_token:`test.${Buffer.from(JSON.stringify({sub:user.id,exp:expires_at})).toString('base64url')}.test`,refresh_token:'test',token_type:'bearer',expires_in:3600,expires_at,user}
  await page.addInitScript(value=>localStorage.setItem('sb-crm-test-auth-token',JSON.stringify(value)),session)
  await page.route('https://crm-test.supabase.co/**',async route=>{
    const path = new URL(route.request().url()).pathname
    const data = path==='/auth/v1/user'?user:path==='/rest/v1/employees'?admin:path==='/rest/v1/rpc/qr_admin_report'?report:{external:{google:true}}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
}
async function completeQuestions(page: Page) {
  await page.getByRole('radio',{name:'Burleson, Texas',exact:true}).check()
  await page.getByRole('radio',{name:'Immediately',exact:true}).check()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('radio',{name:'1-4 units',exact:true}).check()
  await page.getByRole('radio',{name:'Short-term rental',exact:true}).check()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
}
test('QR form is public, validates, conditionally asks credit and submits once with recoverable errors',async ({page},info)=>{
  const errors:string[]=[]
  page.on('pageerror',e=>errors.push(e.message))
  let fails = true
  const sends:Record<string,unknown>[]=[]
  await page.route('https://crm-test.supabase.co/**',async route=>{
    if (route.request().url().includes('/functions/v1/qr-intake')) {
      const body=route.request().postDataJSON()
      if(body.action==='submit') {
        sends.push(body)
        return route.fulfill({status:fails?503:202,contentType:'application/json',body:JSON.stringify(fails?{error:'Test delivery service unavailable. Please retry.'}:{accepted:true,email_status:'sent'})})
      }
      return route.fulfill({status:200,contentType:'application/json',body:'{"accepted":true}'})
    }
    return route.fulfill({status:200,contentType:'application/json',body:'{"external":{"google":true}}'})
  })
  await page.goto('http://127.0.0.1:4174/qr')
  await expect(page).toHaveTitle('Find your container home | CMAC')
  await expect(page.getByRole('heading',{level:1})).toContainText('Seen it.')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  if(['desktop-1440','mobile-375'].includes(info.project.name)) await page.screenshot({path:`/private/tmp/cmac-qr-${info.project.name}.png`,fullPage:true})
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Please complete')
  await completeQuestions(page)
  await page.getByRole('radio',{name:'Financing',exact:true}).check()
  await expect(page.getByRole('group',{name:/If you need financing/})).toBeVisible()
  await page.getByRole('radio',{name:'No',exact:true}).check()
  await page.getByRole('radio',{name:'Cash',exact:true}).check()
  await expect(page.getByRole('group',{name:/If you need financing/})).toHaveCount(0)
  await page.getByLabel('Full name').fill(answers.name)
  await page.getByLabel('Email address').fill(answers.email)
  await page.getByLabel('Phone number').fill('one')
  await page.getByRole('button',{name:'Send my inquiry'}).click()
  await expect(page.getByText('Enter a phone number with 7–15 digits.')).toBeVisible()
  await page.getByLabel('Phone number').fill(answers.phone)
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await expect(page.getByRole('radio',{name:'1-4 units',exact:true})).toBeChecked()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByLabel('Email address')).toHaveValue(answers.email)
  await page.getByRole('button',{name:'Send my inquiry'}).click()
  await expect(page.getByRole('alert')).toContainText('Test delivery service unavailable')
  fails=false
  await page.getByRole('button',{name:'Send my inquiry'}).click()
  await expect(page.getByRole('heading',{name:'You’re on our list.'})).toBeVisible()
  await expect(page.getByText('Charley has been notified by email and can follow up with you.')).toBeVisible()
  expect(sends).toHaveLength(2)
  expect(sends[0].submission_id).toBe(sends[1].submission_id)
  expect(sends[1].answers).toMatchObject({payment:'Cash',credit:'',email:answers.email})
  expect(errors).toEqual([])
})

test('QR inquiries are saved honestly when email is unconfirmed and tracking fails',async ({page})=>{
  await page.route('https://crm-test.supabase.co/**',async route=>{
    if(route.request().url().includes('/functions/v1/qr-intake')) {
      const body=route.request().postDataJSON()
      return route.fulfill({status:body.action==='visit'?503:202,contentType:'application/json',body:JSON.stringify(body.action==='visit'?{error:'Unavailable'}:{accepted:true,email_status:'not_configured'})})
    }
    return route.fulfill({status:200,contentType:'application/json',body:'{"external":{"google":true}}'})
  })
  await page.goto('http://127.0.0.1:4174/qr')
  await completeQuestions(page)
  await page.getByRole('radio',{name:'Financing',exact:true}).check()
  await page.getByLabel('Full name').fill(answers.name)
  await page.getByLabel('Email address').fill(answers.email)
  await page.getByLabel('Phone number').fill(answers.phone)
  await page.getByRole('button',{name:'Send my inquiry'}).click()
  await expect(page.getByRole('alert')).toContainText('Please complete')
  await page.getByRole('radio',{name:'No',exact:true}).check()
  await page.getByRole('button',{name:'Send my inquiry'}).click()
  await expect(page.getByText(/Charley’s email notification is awaiting confirmation/)).toBeVisible()
})

test('admin QR report has accurate labels, details, date filtering and confirmed retry',async ({page},info)=>{
  await mockAuth(page)
  await page.goto('http://127.0.0.1:4174/employee-portal/admin/qr')
  await page.reload()
  await expect(page.getByRole('heading',{name:'From scan to conversation.'})).toBeVisible()
  await expect(page.getByText('QR-page visits',{exact:true})).toBeVisible()
  await expect(page.getByText('10%',{exact:true})).toBeVisible()
  await page.getByText('Jamie Sample',{exact:true}).click()
  await expect(page.getByText('Gmail authorization unavailable.')).toBeVisible()
  await expect(page.getByRole('link',{name:answers.email})).toBeVisible()
  await expect(page.getByText('No',{exact:true})).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  if(['desktop-1440','mobile-375'].includes(info.project.name)) await page.screenshot({path:`/private/tmp/cmac-qr-admin-${info.project.name}.png`,fullPage:true})
  await page.route('**/functions/v1/qr-intake',route=>route.fulfill({status:200,contentType:'application/json',body:'{"accepted":true,"email_status":"sent"}'}))
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Retry email to Charley'}).click()
  await expect(page.getByText('Gmail confirmed the email was sent to Charley.',{exact:true})).toBeVisible()
  const request=page.waitForRequest(req=>req.url().includes('qr_admin_report')&&req.postDataJSON().p_days===7)
  await page.getByLabel('Reporting period').selectOption('7')
  await request
})

test('sales representatives are blocked from QR reporting',async ({page})=>{
  await mockAuth(page,'sales_rep')
  await page.goto('http://127.0.0.1:4174/employee-portal/admin/qr')
  await expect(page.getByRole('heading',{name:'Admin access required'})).toBeVisible()
  await expect(page.getByText('Jamie Sample')).toHaveCount(0)
})

test('admin QR reporting recovers from service errors and displays a genuine empty state',async ({page})=>{
  await mockAuth(page)
  let unavailable=true
  await page.route('**/rest/v1/rpc/qr_admin_report',route=>route.fulfill({
    status:unavailable?503:200,contentType:'application/json',
    body:JSON.stringify(unavailable?{message:'Reporting temporarily unavailable',code:'TEST_UNAVAILABLE'}:{...report,visits:0,submissions:0,sent:0,attention:0,converted_visits:0,rows:[]}),
  }))
  await page.goto('http://127.0.0.1:4174/employee-portal/admin/qr')
  await expect(page.getByText('Reporting temporarily unavailable',{exact:true})).toBeVisible()
  unavailable=false
  await page.getByRole('button',{name:'Retry',exact:true}).click()
  await expect(page.getByText('No QR inquiries yet',{exact:true})).toBeVisible()
  await expect(page.getByText('0 inquiries',{exact:true})).toBeVisible()
})

test('QR option cards support keyboard selection and step navigation',async ({page})=>{
  await page.route('https://crm-test.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"accepted":true}'}))
  await page.goto('http://127.0.0.1:4174/qr')
  const location=page.getByRole('radio',{name:'Burleson, Texas',exact:true})
  await location.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio',{name:'Weatherford, Texas',exact:true})).toBeChecked()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio',{name:'Immediately',exact:true})).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('radio',{name:'1-4 units',exact:true})).toBeVisible()
})
