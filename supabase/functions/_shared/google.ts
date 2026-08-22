import { signedServiceAccountJwt } from './jwt.ts'

export async function gmailAccessToken(employeeEmail: string) {
  const serviceEmail = Deno.env.get('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL')?.trim()
  const privateKey = Deno.env.get('GOOGLE_WORKSPACE_PRIVATE_KEY')?.trim()
  if (!serviceEmail || !privateKey) throw new Error('Gmail delegation is not configured.')
  const now = Math.floor(Date.now() / 1000)
  const assertion = await signedServiceAccountJwt({ iss: serviceEmail, sub: employeeEmail, scope: 'https://www.googleapis.com/auth/gmail.send', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }, privateKey)
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  const payload = await response.json() as { access_token?: string; error_description?: string }
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? 'Google did not issue a Gmail access token.')
  return payload.access_token
}
