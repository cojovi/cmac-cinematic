import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey)

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, publishableKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function googleProviderIsEnabled() {
  if (!supabaseUrl || !publishableKey) return false
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
  })
  if (!response.ok) throw new Error('The employee sign-in service could not be checked.')
  const settings = await response.json() as { external?: { google?: boolean } }
  return settings.external?.google === true
}

export const localPortalPreviewEnabled = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_LOCAL_PORTAL_PREVIEW === 'true'
