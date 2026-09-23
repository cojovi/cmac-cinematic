import { supabase } from './supabase'
import { isUuid, type QrAnswers, type QrEmailStatus } from '../../supabase/functions/_shared/qr'

export interface QrSubmission extends QrAnswers { id: string; created_at: string; email_status: QrEmailStatus; sent_at: string | null; email_error: string | null; attempts: number }
export interface QrReport { visits: number; submissions: number; sent: number; attention: number; converted_visits: number; rows: QrSubmission[]; generated_at: string }
export async function qrRequest(body: Record<string, unknown>): Promise<{ accepted?: boolean; email_status?: QrEmailStatus; errors?: Record<string, string> }> {
  if (!supabase) throw new Error('This form is not connected yet. Please call (682) 218-7221.')
  const { data, error } = await supabase.functions.invoke('qr-intake', { body, signal: AbortSignal.timeout(45_000) })
  if (error) {
    let message = 'We could not confirm receipt. Your answers are still here—please try again.'
    if ('context' in error && error.context instanceof Response) {
      try { message = (await error.context.clone().json()).error || message } catch { /* Keep a safe recovery message. */ }
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// One visit per 30-minute tab session, not a claim of unique people or scans.
export function qrVisitId(storage: Pick<Storage, 'getItem' | 'setItem'> | null, now = Date.now()) {
  try {
    const previous = JSON.parse(storage?.getItem('cmac-qr-visit') || 'null') as { id?: string; expires?: number } | null
    if (isUuid(previous?.id) && (previous?.expires ?? 0) > now) return previous!.id!
  } catch { /* Storage can be disabled in QR scanner browsers. */ }
  const id = crypto.randomUUID()
  try { storage?.setItem('cmac-qr-visit', JSON.stringify({ id, expires: now + 30 * 60_000 })) } catch { /* Form works without storage. */ }
  return id
}
