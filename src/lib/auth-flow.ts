const AUTH_CALLBACK_PATH = '/auth/callback'
const AUTH_LOGIN_PATH = '/login'
const DEFAULT_PRODUCTION_ORIGIN = 'https://www.cmaccontainers.com'
const PRODUCTION_AUTH_HOSTS = new Set(['www.cmaccontainers.com', 'cmaccontainers.com', 'cmac-cinematic.vercel.app'])
const PKCE_RECOVERY_KEY = 'cmac-oauth-pkce-recovery'
const PKCE_RECOVERY_WINDOW_MS = 5 * 60 * 1000

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

export function canonicalAuthOrigin(currentOrigin: string, configuredOrigin = import.meta.env.VITE_CANONICAL_SITE_URL?.trim()) {
  const current = new URL(currentOrigin)
  const canonical = new URL(configuredOrigin || DEFAULT_PRODUCTION_ORIGIN)
  const isGeneratedVercelDeployment = current.hostname.endsWith('.vercel.app')
    && current.hostname !== canonical.hostname
    && current.hostname.startsWith('cmac-cinematic-')

  // Start OAuth on the same stable origin that receives its callback. The
  // verifier lives in origin-scoped storage, so crossing from the apex or old
  // Vercel address after Google returns would require a second sign-in.
  return isGeneratedVercelDeployment || PRODUCTION_AUTH_HOSTS.has(current.hostname)
    ? canonical.origin
    : current.origin
}

export function canonicalGoogleLoginUrl(currentOrigin: string) {
  const url = new URL(AUTH_LOGIN_PATH, `${canonicalAuthOrigin(currentOrigin)}/`)
  url.searchParams.set('continue', 'google')
  return url.toString()
}

export function claimPkceRecovery(storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()) {
  const previousAttempt = Number(storage.getItem(PKCE_RECOVERY_KEY))
  if (Number.isFinite(previousAttempt) && previousAttempt > 0 && now - previousAttempt < PKCE_RECOVERY_WINDOW_MS) return false
  storage.setItem(PKCE_RECOVERY_KEY, String(now))
  return true
}

export function clearPkceRecovery(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(PKCE_RECOVERY_KEY)
}

export function friendlyProviderError(search: string) {
  const providerError = providerErrorFromSearch(search)
  if (!providerError) return null
  if (providerError.toLowerCase().includes('access_denied')) return 'Google sign-in was canceled. No account changes were made.'
  return 'Google could not complete sign-in. Please try again with an authorized CMAC account.'
}

export function providerErrorFromSearch(search: string) {
  const params = new URLSearchParams(search)
  return params.get('error_description') ?? params.get('error')
}
