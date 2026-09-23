import { requireEmployee, serviceClient } from '../_shared/auth.ts'
import { gmailAccessToken } from '../_shared/google.ts'
import { json, options, parseJson } from '../_shared/http.ts'
import { isUuid, validateQrAnswers, type QrAnswers } from '../_shared/qr.ts'
import { deliverQrNotification } from '../_shared/qr-delivery.ts'

async function hash(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))
  return Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('')
}

async function notify(client: ReturnType<typeof serviceClient>, id: string) {
  const claim = await client.rpc('claim_qr_notification', { p_id: id })
  if (claim.error) throw new Error('Notification claim unavailable.')
  const record = claim.data?.[0] as (QrAnswers & { attempts: number }) | undefined
  if (!record) return null
  const delivery = await deliverQrNotification(record,id,gmailAccessToken)
  const saved = await client.from('qr_submissions').update({ email_status: delivery.status, email_error: delivery.error, provider_message_id: delivery.messageId ?? null, sent_at: delivery.status === 'sent' ? new Date().toISOString() : null }).eq('id',id).eq('email_status','sending').eq('attempts',record.attempts).select('id').single()
  // Never report sent when its durable status could not be recorded. A stranded
  // sending row requires manual verification and cannot be sent again.
  if (saved.error) return 'unknown'
  return delivery.status
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request,{ error: 'Method not allowed.' },405)
  let input: Record<string, unknown>
  try { input = await parseJson(request, 12_000); if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid body') }
  catch { return json(request,{ error: 'Please submit a valid form.' },400) }
  try {
    if (input.action === 'retry') {
      const auth = await requireEmployee(request,true)
      if (!('employee' in auth)) return json(request,{ error: auth.error },auth.status)
      if (!isUuid(input.submission_id)) return json(request,{ error: 'Invalid inquiry reference.' },422)
      const status = await notify(auth.client,input.submission_id)
      if (!status) return json(request,{ error: 'This notification cannot be retried yet. Refresh the report. Sent or unconfirmed emails are never resent automatically.' },409)
      return json(request,{ accepted: true,email_status: status })
    }
    if (!['visit','submit'].includes(String(input.action))) return json(request,{ error: 'Unknown request.' },400)
    if (!isUuid(input.visit_id)) return json(request,{ error: 'Please reload the form and try again.' },422)
    const secret = Deno.env.get('QR_RATE_LIMIT_SECRET')?.trim() || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!secret) return json(request,{ error: 'Inquiry service is not configured. Please call (682) 218-7221.' },503)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || 'unknown'
    const ipHash = await hash(ip,secret)
    const client = serviceClient()
    if (input.action === 'visit') {
      const result = await client.rpc('record_qr_visit',{ p_visit_id: input.visit_id,p_ip_hash: ipHash })
      if (result.error) return json(request,{ error: 'Visit could not be recorded.' },result.error.code === 'P0001' ? 429 : 503)
      return json(request,{ accepted: true })
    }
    // Honeypots are not counted, saved, or emailed.
    if (input.website) return json(request,{ accepted: true,email_status: 'pending' },202)
    if (!isUuid(input.submission_id)) return json(request,{ error: 'Please reload the form and try again.' },422)
    const { data: answers,errors } = validateQrAnswers(input.answers)
    if (Object.keys(errors).length) return json(request,{ error: 'Please check the highlighted form fields.',errors },422)
    const [fingerprint,emailHash] = await Promise.all([hash(JSON.stringify(answers),secret),hash(answers.email,secret)])
    const saved = await client.rpc('submit_qr_inquiry',{ p_id: input.submission_id,p_visit_id: input.visit_id,p_answers: answers,p_fingerprint: fingerprint,p_ip_hash: ipHash,p_email_hash: emailHash })
    if (saved.error) {
      if (saved.error.code === 'P0001') return json(request,{ error: 'Too many inquiries. Please wait before trying again, or call (682) 218-7221.' },429)
      if (saved.error.code === '22023') return json(request,{ error: 'This request was already submitted. Reload the page to start a different inquiry.' },409)
      throw new Error('Inquiry storage unavailable.')
    }
    let status = saved.data.email_status
    if (saved.data.created) {
      try { status = await notify(client,input.submission_id) ?? status } catch { status = 'pending' }
    }
    return json(request,{ accepted: true,email_status: status },202)
  } catch {
    // Never log customer answers, credit details, tokens, or provider payloads.
    return json(request,{ error: 'We could not confirm receipt. Please try again or call (682) 218-7221.' },503)
  }
})
