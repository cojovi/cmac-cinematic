import { serviceClient } from '../_shared/auth.ts'
import { docusignAccessToken, docusignConfig } from '../_shared/docusign.ts'
import { corsHeaders, json, options } from '../_shared/http.ts'

interface WebhookPayload { event?: string; generatedDateTime?: string; data?: { envelopeId?: string }; envelopeId?: string; status?: string }

async function validSignature(body: Uint8Array, supplied: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, body))
  let actual: Uint8Array
  try { actual = Uint8Array.from(atob(supplied), (character) => character.charCodeAt(0)) } catch { return false }
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index]
  return difference === 0
}

async function retrieveCompletedDocuments(contractId: string, envelopeId: string) {
  const config = docusignConfig()
  const token = await docusignAccessToken(config)
  const client = serviceClient()
  const base = `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents`
  const files = [
    { remote: 'combined', path: `contracts/${contractId}/signed-agreement.pdf`, column: 'signed_document_path' },
    { remote: 'certificate', path: `contracts/${contractId}/completion-certificate.pdf`, column: 'completion_certificate_path' },
  ]
  const updates: Record<string, string> = {}
  for (const file of files) {
    const response = await fetch(`${base}/${file.remote}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } })
    if (!response.ok) throw new Error(`DocuSign document retrieval failed with HTTP ${response.status}.`)
    const { error } = await client.storage.from('signed-contracts').upload(file.path, await response.blob(), { contentType: 'application/pdf', upsert: true })
    if (error) throw error
    updates[file.column] = file.path
  }
  const { error } = await client.from('contracts').update({ ...updates, error_message: null }).eq('id', contractId)
  if (error) throw error
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  const secret = Deno.env.get('DOCUSIGN_WEBHOOK_HMAC_SECRET')?.trim()
  if (!secret) return json(request, { error: 'DocuSign webhook is not configured.' }, 503)
  const raw = new Uint8Array(await request.arrayBuffer())
  const signature = request.headers.get('x-docusign-signature-1') ?? ''
  if (!await validSignature(raw, signature, secret)) return json(request, { error: 'Invalid webhook signature.' }, 401)
  try {
    const payload = JSON.parse(new TextDecoder().decode(raw)) as WebhookPayload
    const envelopeId = payload.data?.envelopeId ?? payload.envelopeId
    const eventType = payload.event ?? (payload.status ? `envelope-${payload.status.toLowerCase()}` : '')
    const occurredAt = payload.generatedDateTime ?? new Date().toISOString()
    if (!envelopeId || !eventType) return json(request, { error: 'Envelope identity and event type are required.' }, 422)
    const eventId = `${envelopeId}:${eventType}:${occurredAt}`
    const client = serviceClient()
    const { data, error } = await client.rpc('process_contract_event', { p_provider_event_id: eventId, p_envelope_id: envelopeId, p_event_type: eventType.toLowerCase(), p_occurred_at: occurredAt, p_payload: payload })
    if (error) throw error
    const result = data as { found?: boolean; contract_id?: string; status?: string }
    if (!result.found) return new Response(null, { status: 204, headers: corsHeaders(request) })
    if (eventType.toLowerCase() === 'envelope-completed' && result.contract_id) {
      try { await retrieveCompletedDocuments(result.contract_id, envelopeId) }
      catch (documentError) {
        await client.from('contracts').update({ error_message: documentError instanceof Error ? documentError.message : 'Completed documents could not be archived.' }).eq('id', result.contract_id)
        throw documentError
      }
    }
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  } catch (error) {
    console.error('docusign-webhook failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: 'Webhook processing failed.' }, 500)
  }
})
