const AUTH_CALLBACK_PATH = '/auth/callback'

const oauthResponseKeys = ['code', 'error', 'error_code', 'error_description'] as const

export function hasOAuthResponse(search: string) {
  const params = new URLSearchParams(search)
  return oauthResponseKeys.some((key) => params.has(key))
}

export function authCallbackRoute(search: string) {
  return `${AUTH_CALLBACK_PATH}${search.startsWith('?') ? search : search ? `?${search}` : ''}`
}

export function authCallbackUrl(origin: string) {
  return new URL(AUTH_CALLBACK_PATH, `${origin.replace(/\/$/, '')}/`).toString()
}

export function providerErrorFromSearch(search: string) {
  const params = new URLSearchParams(search)
  return params.get('error_description') ?? params.get('error')
}
