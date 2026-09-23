import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), requireEmployee: vi.fn(), deliver: vi.fn(), serve: vi.fn() }))
vi.mock('../../supabase/functions/_shared/auth.ts', () => ({ serviceClient: () => ({ rpc: mocks.rpc, from: mocks.from }), requireEmployee: mocks.requireEmployee }))
vi.mock('../../supabase/functions/_shared/google.ts', () => ({ gmailAccessToken: vi.fn() }))
vi.mock('../../supabase/functions/_shared/qr-delivery.ts', () => ({ deliverQrNotification: mocks.deliver }))
vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'QR_RATE_LIMIT_SECRET' ? 'unit-test-only-secret-not-for-production' : undefined }, serve: mocks.serve })
await import('../../supabase/functions/qr-intake/index.ts')
const handler = mocks.serve.mock.calls[0][0] as (request: Request) => Promise<Response>
const payload = { action: 'submit', visit_id: '10000000-0000-4000-8000-000000000001', submission_id: '20000000-0000-4000-8000-000000000001', answers: { name: 'Test Visitor', email: 'test@example.com', phone: '6825550100', location: 'Burleson, Texas', timing: 'Immediately', units: '1-4 units', use: 'Short-term rental', payment: 'Cash', credit: '' } }
function request(body: unknown) { return handler(new Request('https://example.com/qr-intake',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)})) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockImplementation(async name => ({ data: name === 'claim_qr_notification' ? [{ ...payload.answers, attempts: 1 }] : { created: true, email_status: 'pending' }, error: null }))
  const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({data:{id:payload.submission_id},error:null}) }
  mocks.from.mockReturnValue(query)
  mocks.deliver.mockResolvedValue({status:'sent',error:null,messageId:'test-message'})
  mocks.requireEmployee.mockResolvedValue({error:'Administrator access is required.',status:403})
})
describe('QR endpoint', () => {
  it('rejects spoofed retry identity without touching data', async () => {
    const response = await request({action:'retry',submission_id:payload.submission_id,role:'admin',employee_id:'spoofed'})
    expect(response.status).toBe(403)
    expect(mocks.requireEmployee).toHaveBeenCalledWith(expect.any(Request),true)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it('rejects malformed and invalid submissions', async () => {
    expect((await request(null)).status).toBe(400)
    expect((await request({...payload,answers:{...payload.answers,phone:'one'}})).status).toBe(422)
    expect((await request({...payload,submission_id:'bad-id'})).status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('never records or emails honeypot traffic', async () => {
    expect((await request({...payload,website:'spam'})).status).toBe(202)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('persists before sending, hashes identifiers and ignores supplied recipient', async () => {
    const response = await request({...payload,recipient:'attacker@example.com'})
    expect(await response.json()).toEqual({accepted:true,email_status:'sent'})
    expect(mocks.rpc.mock.calls[0][0]).toBe('submit_qr_inquiry')
    expect(mocks.rpc.mock.calls[0][1].p_ip_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.rpc.mock.calls[0][1].p_email_hash).not.toBe(payload.answers.email)
    expect(mocks.deliver).toHaveBeenCalledTimes(1)
  })
  it('does not send or count a public retry twice', async () => {
    mocks.rpc.mockResolvedValue({data:{created:false,email_status:'sent'},error:null})
    expect(await (await request(payload)).json()).toEqual({accepted:true,email_status:'sent'})
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it('handles simultaneous claims without another send', async () => {
    mocks.rpc.mockImplementation(async name=>({data:name==='claim_qr_notification'?[]:{created:true,email_status:'pending'},error:null}))
    expect((await (await request(payload)).json()).email_status).toBe('pending')
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it('keeps saved inquiries visible when Gmail is not configured', async () => {
    mocks.deliver.mockResolvedValue({status:'not_configured',error:'Setup needed'})
    expect(await (await request(payload)).json()).toEqual({accepted:true,email_status:'not_configured'})
  })
  it('never reports sent if durable outcome recording fails', async () => {
    mocks.from().single.mockResolvedValue({error:{message:'DB unavailable'}})
    expect((await (await request(payload)).json()).email_status).toBe('unknown')
  })
  it('does not email an unsaved or rate-limited form', async () => {
    mocks.rpc.mockResolvedValue({error:{code:'P0001'}})
    expect((await request(payload)).status).toBe(429)
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it('rejects oversize body and wrong methods', async () => {
    expect((await request({text:'x'.repeat(13_000)})).status).toBe(400)
    expect((await handler(new Request('https://example.com/qr-intake'))).status).toBe(405)
  })
})
