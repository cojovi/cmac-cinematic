import { signedServiceAccountJwt } from './jwt.ts'

export interface DocuSignConfig { integrationKey: string; userId: string; accountId: string; baseUrl: string; oauthBaseUrl: string; privateKey: string }

export function docusignConfig(): DocuSignConfig {
  const config = {
    integrationKey: Deno.env.get('DOCUSIGN_INTEGRATION_KEY')?.trim() ?? '',
    userId: Deno.env.get('DOCUSIGN_USER_ID')?.trim() ?? '',
    accountId: Deno.env.get('DOCUSIGN_ACCOUNT_ID')?.trim() ?? '',
    baseUrl: Deno.env.get('DOCUSIGN_BASE_URL')?.trim() ?? 'https://demo.docusign.net/restapi',
    oauthBaseUrl: Deno.env.get('DOCUSIGN_OAUTH_BASE_URL')?.trim() ?? 'https://account-d.docusign.com',
    privateKey: Deno.env.get('DOCUSIGN_PRIVATE_KEY')?.trim() ?? '',
  }
  if (!config.integrationKey || !config.userId || !config.accountId || !config.privateKey) throw new Error('DocuSign is not configured.')
  return config
}

export async function docusignAccessToken(config: DocuSignConfig) {
  const now = Math.floor(Date.now() / 1000)
  const audience = new URL(config.oauthBaseUrl).host
  const assertion = await signedServiceAccountJwt({ iss: config.integrationKey, sub: config.userId, aud: audience, scope: 'signature impersonation', iat: now, exp: now + 3600 }, config.privateKey)
  const response = await fetch(`${config.oauthBaseUrl}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  const payload = await response.json() as { access_token?: string; error_description?: string }
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? 'DocuSign did not issue an access token.')
  return payload.access_token
}
