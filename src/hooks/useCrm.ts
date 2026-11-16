import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import type { Actor } from '../lib/crm/api'
import { useToast } from './useToast'

/** The signed-in employee in the shape the CRM write layer expects. */
export function useActor(): Actor & { isAdmin: boolean } {
  const { employee } = useAuth()
  return useMemo(() => ({
    id: employee?.id ?? '',
    role: employee?.role ?? 'sales_rep',
    display_name: employee?.display_name ?? '',
    isAdmin: employee?.role === 'admin',
  }), [employee?.display_name, employee?.id, employee?.role])
}

/** A clock for relative dates. Ticks once a minute so "due in 5m" does not go stale on an open tab. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * Runs one write at a time, reports the result as a toast, and resolves to
 * whether it succeeded so callers can close a dialog or clear a form.
 */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const run = useCallback(async (action: () => Promise<unknown>, success?: string) => {
    if (running.current) return false
    running.current = true
    setBusy(true)
    try {
      await action()
      if (success) toast.success(success)
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'That change could not be saved. Please try again.')
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [toast])
  return { run, busy }
}
