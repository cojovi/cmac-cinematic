import { supabase } from './supabase'

export type LeadAction = 'create' | 'update' | 'convert'

export interface LeadActionResult {
  lead_id?: string
  contact_id?: string
  deal_id?: string
  deal_number?: string
  assigned_employee_id?: string
  message?: string
  error?: string
}

export async function runLeadAction(action: LeadAction, lead: Record<string, unknown>, leadId?: string) {
  if (!supabase) throw new Error('The CRM is not configured in this environment.')

  const { data, error } = await supabase.functions.invoke<LeadActionResult>('manage-lead', {
    body: { action, lead_id: leadId, lead },
  })

  if (error) {
    let message = error.message
    if ('context' in error && error.context instanceof Response) {
      try {
        const detail = await error.context.clone().json() as { error?: string }
        if (detail.error) message = detail.error
      } catch {
        // Preserve the provider error when the response body is not JSON.
      }
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data ?? {}
}
