import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { EmployeeRow } from '../lib/database.types'

export interface AuthContextValue {
  session: Session | null
  employee: EmployeeRow | null
  loading: boolean
  configured: boolean
  googleProviderStatus: 'checking' | 'enabled' | 'disabled' | 'unavailable'
  previewMode: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
