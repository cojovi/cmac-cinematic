import { serviceClient } from '../_shared/auth.ts'
import { json, options, parseJson } from '../_shared/http.ts'

interface LeadInput { name?: string; phone?: string; email?: string; projectType?: string; location?: string; timing?: string; website?: string }

function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

async function hashIdentifier(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  try {
    const input = await parseJson<LeadInput>(request, 12_000)
    if (input.website) return json(request, { accepted: true }, 202)
    const name = clean(input.name, 120)
    const email = clean(input.email, 254).toLowerCase()
    const phone = clean(input.phone, 40)
    const projectType = clean(input.projectType, 80)
    const location = clean(input.location, 160)
    const timing = clean(input.timing, 80)
    if (name.length < 2 || phone.length < 7 || !validEmail(email) || !projectType || location.length < 2 || !timing) return json(request, { error: 'Review the submitted fields.' }, 422)

    const secret = Deno.env.get('LEAD_RATE_LIMIT_SECRET')?.trim()
    if (!secret || secret.length < 32) return json(request, { error: 'Lead intake is not configured.' }, 503)
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || 'unknown'
    const [ipHash, emailHash] = await Promise.all([hashIdentifier(forwarded, secret), hashIdentifier(email, secret)])
    const nameParts = name.split(/\s+/)
    const client = serviceClient()
    const { error } = await client.rpc('submit_public_lead', {
      p_first_name: nameParts[0], p_last_name: nameParts.slice(1).join(' '), p_display_name: name,
      p_email: email, p_phone: phone, p_project_type: projectType, p_project_location: location,
      p_desired_timing: timing, p_ip_hash: ipHash, p_email_hash: emailHash,
    })
    if (error) throw error
    return json(request, { accepted: true }, 202)
  } catch (error) {
    console.error('submit-lead failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: 'The inquiry could not be accepted.' }, 500)
  }
})
