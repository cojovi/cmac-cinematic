import { describe, expect, it, vi } from 'vitest'
import { isUuid, qrEmailBody, qrRecipient, validateQrAnswers } from '../../supabase/functions/_shared/qr'
import { deliverQrNotification } from '../../supabase/functions/_shared/qr-delivery'
import { qrVisitId } from './qr-api'

const answers = { name: 'Jamie Sample', email: 'jamie@example.com', phone: '(682) 555-0100', location: 'Burleson, Texas', timing: 'Immediately', units: '1-4 units', use: 'Short-term rental', payment: 'Cash', credit: '' }
const id = '10000000-0000-4000-8000-000000000001'
describe('QR validation and privacy', () => {
  it('normalizes contact fields and discards irrelevant credit answers', () => {
    const result = validateQrAnswers({ ...answers, email: ' JAMIE@EXAMPLE.COM ', credit: 'Yes', recipient: 'attacker@example.com' })
    expect(result.errors).toEqual({})
    expect(result.data.email).toBe('jamie@example.com')
    expect(result.data.credit).toBe('')
    expect(result.data).not.toHaveProperty('recipient')
  })
  it('requires credit only for financing', () => {
    expect(validateQrAnswers({ ...answers, payment: 'Financing' }).errors.credit).toBeDefined()
    expect(validateQrAnswers({ ...answers, payment: 'Financing', credit: 'No' }).errors).toEqual({})
  })
  it.each(['location', 'timing', 'units', 'use', 'payment'])('rejects unknown %s options', key => {
    expect(validateQrAnswers({ ...answers, [key]: 'untrusted' }).errors).toHaveProperty(key)
  })
  it('rejects invalid types, header injection and invalid phones', () => {
    expect(Object.keys(validateQrAnswers(null).errors).length).toBeGreaterThan(4)
    expect(validateQrAnswers({ ...answers, email: 'jamie@example.com\r\nBcc: attacker@example.com' }).errors.email).toBeDefined()
    expect(validateQrAnswers({ ...answers, name: 'Jamie\nX', phone: 'one' }).errors).toHaveProperty('phone')
    expect(isUuid('arbitrary-id')).toBe(false)
  })
  it('includes every answer and contact field in the email body', () => {
    const body = qrEmailBody(answers,id)
    for (const value of Object.values(answers).filter(Boolean)) expect(body).toContain(value)
    expect(body).toContain('Not applicable (paying cash)')
  })
  it('deduplicates visits within a tab session and expires after 30 minutes', () => {
    const values = new Map<string,string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value) } }
    const first = qrVisitId(storage,0)
    expect(qrVisitId(storage,100)).toBe(first)
    expect(qrVisitId(storage,31 * 60_000)).not.toBe(first)
    expect(isUuid(qrVisitId({ getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }))).toBe(true)
  })
})
describe('QR email delivery', () => {
  it('sends only to Charley with a reply-to and correctly encoded content', async () => {
    const token = vi.fn().mockResolvedValue('test-token')
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'gmail-confirmed' })))
    const result = await deliverQrNotification(answers,id,token,send)
    expect(token).toHaveBeenCalledWith(qrRecipient)
    expect(result).toEqual({ status: 'sent', error: null, messageId: 'gmail-confirmed' })
    const mime = atob(JSON.parse(send.mock.calls[0][1].body).raw.replaceAll('-','+').replaceAll('_','/'))
    expect(mime).toContain(`To: ${qrRecipient}\r\n`)
    expect(mime).toContain('Reply-To: jamie@example.com\r\n')
    expect(atob(mime.split('\r\n\r\n')[1].replaceAll('\r\n',''))).toContain(answers.phone)
  })
  it('does not fake success or send without Gmail configuration', async () => {
    const send = vi.fn()
    expect((await deliverQrNotification(answers,id,async () => { throw new Error('missing secret') },send)).status).toBe('not_configured')
    expect(send).not.toHaveBeenCalled()
  })
  it('distinguishes missing secrets without exposing provider errors or credentials', async () => {
    const missing = await deliverQrNotification(answers,id,async () => { throw new Error('Gmail delegation is not configured.') })
    expect(missing.error).toContain('service-account secrets are missing')
    const rejected = await deliverQrNotification(answers,id,async () => { throw new Error('private provider details') })
    expect(rejected.error).not.toContain('private provider details')
  })
  it.each([400,401,403,429])('records a rejected email for HTTP %s', async status => {
    expect((await deliverQrNotification(answers,id,async () => 'test',async () => new Response('{}',{ status }))).status).toBe('failed')
  })
  it('does not retry or claim success on network uncertainty, 5xx, or missing message IDs', async () => {
    const disconnected = vi.fn().mockRejectedValue(new Error('lost connection'))
    expect((await deliverQrNotification(answers,id,async () => 'test',disconnected)).status).toBe('unknown')
    expect(disconnected).toHaveBeenCalledTimes(1)
    expect((await deliverQrNotification(answers,id,async () => 'test',async () => new Response('{}',{status:503}))).status).toBe('unknown')
    expect((await deliverQrNotification(answers,id,async () => 'test',async () => new Response('{}'))).status).toBe('unknown')
  })
})
