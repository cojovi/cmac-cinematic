import { canAccessOwnedRecord, requireEmployee } from '../_shared/auth.ts'
import { gmailAccessToken } from '../_shared/google.ts'
import { bytesToBase64, stringToBase64Url } from '../_shared/jwt.ts'
import { json, options, parseJson } from '../_shared/http.ts'

interface Input { contact_id?: string; lead_id?: string; material_ids?: string[]; subject?: string; body?: string }
const maxAttachmentBytes = 18 * 1024 * 1024

function cleanHeader(value: string) { return value.replace(/[\r\n]+/g, ' ').trim() }
function wrapBase64(value: string) { return value.match(/.{1,76}/g)?.join('\r\n') ?? value }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  const auth = await requireEmployee(request)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)
  try {
    const input = await parseJson<Input>(request, 64_000)
    const materialIds = Array.from(new Set(input.material_ids ?? [])).slice(0, 20)
    const subject = cleanHeader(input.subject ?? '').slice(0, 180)
    const body = (input.body ?? '').trim().slice(0, 20_000)
    if (!input.contact_id || !subject || !body || materialIds.length === 0) return json(request, { error: 'Contact, subject, message, and approved materials are required.' }, 422)

    const client = auth.client
    const { data: contact, error: contactError } = await client.from('contacts').select('id,email,display_name,assigned_employee_id').eq('id', input.contact_id).maybeSingle()
    if (contactError || !contact || !canAccessOwnedRecord(auth.employee, contact.assigned_employee_id)) return json(request, { error: 'The contact is outside your assigned CRM scope.' }, 403)
    const { data: materials, error: materialsError } = await client.from('marketing_materials').select('id,title,storage_path,file_name,mime_type,file_size,is_active').in('id', materialIds).eq('is_active', true)
    if (materialsError || !materials || materials.length !== materialIds.length) return json(request, { error: 'One or more materials are inactive or unavailable.' }, 422)
    const totalBytes = materials.reduce((sum, item) => sum + Number(item.file_size), 0)
    if (totalBytes > maxAttachmentBytes) return json(request, { error: 'Selected attachments exceed the 18 MB pre-encoding limit.' }, 422)

    let accessToken: string
    try { accessToken = await gmailAccessToken(auth.employee.email) }
    catch (error) { return json(request, { error: error instanceof Error ? error.message : 'Gmail is not configured.' }, 503) }

    const boundary = `cmac_${crypto.randomUUID().replaceAll('-', '')}`
    const mimeParts = [
      `From: ${cleanHeader(auth.employee.display_name)} <${cleanHeader(auth.employee.email)}>`,
      `To: ${cleanHeader(contact.display_name)} <${cleanHeader(contact.email)}>`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
      `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', body,
    ]
    for (const material of materials) {
      const { data: file, error: downloadError } = await client.storage.from('marketing-materials').download(material.storage_path)
      if (downloadError || !file) throw new Error(`Approved material “${material.title}” could not be loaded.`)
      const safeName = cleanHeader(material.file_name).replaceAll('"', '')
      mimeParts.push(`--${boundary}`, `Content-Type: ${material.mime_type}; name="${safeName}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${safeName}"`, '', wrapBase64(bytesToBase64(new Uint8Array(await file.arrayBuffer()))))
    }
    mimeParts.push(`--${boundary}--`, '')

    const { data: sendRecord, error: insertError } = await client.from('marketing_sends').insert({ employee_id: auth.employee.id, contact_id: contact.id, lead_id: input.lead_id ?? null, subject, body, recipient_email: contact.email, status: 'pending' }).select('id').single()
    if (insertError) throw insertError
    await client.from('marketing_send_items').insert(materialIds.map((materialId) => ({ marketing_send_id: sendRecord.id, marketing_material_id: materialId })))

    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: stringToBase64Url(mimeParts.join('\r\n')) }) })
      const result = await response.json() as { id?: string; threadId?: string; error?: { message?: string } }
      if (!response.ok || !result.id) {
        await client.from('marketing_sends').update({ status: 'failed', error_message: result.error?.message ?? `Gmail returned HTTP ${response.status}` }).eq('id', sendRecord.id)
        return json(request, { error: result.error?.message ?? 'Gmail rejected the message.' }, 502)
      }
      await client.from('marketing_sends').update({ status: 'sent', gmail_message_id: result.id, gmail_thread_id: result.threadId ?? null, sent_at: new Date().toISOString() }).eq('id', sendRecord.id)
      await client.from('activities').insert({ contact_id: contact.id, lead_id: input.lead_id ?? null, employee_id: auth.employee.id, activity_type: 'marketing_sent', title: `Approved materials sent: ${subject}`, metadata: { marketing_send_id: sendRecord.id, material_count: materialIds.length } })
      return json(request, { message: 'Gmail confirmed the message was sent.', send_id: sendRecord.id })
    } catch (error) {
      await client.from('marketing_sends').update({ status: 'unknown', error_message: 'The provider outcome is ambiguous; verify Gmail before retrying.' }).eq('id', sendRecord.id)
      console.error('Gmail outcome ambiguous', error instanceof Error ? error.message : 'unknown error')
      return json(request, { error: 'The Gmail outcome is ambiguous. Check Sent mail before retrying.' }, 502)
    }
  } catch (error) {
    console.error('send-marketing-email failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: error instanceof Error ? error.message : 'Marketing email could not be prepared.' }, 500)
  }
})
