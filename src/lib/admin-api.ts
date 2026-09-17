import { supabase } from './supabase'

export async function runAdminAction(body: Record<string, unknown>) {
  if (!supabase) throw new Error('The CRM is not configured.')
  const { data, error } = await supabase.functions.invoke('admin-manage-employee', { body })
  if (error) {
    let message = error.message
    if ('context' in error && error.context instanceof Response) {
      try { message = (await error.context.clone().json()).error ?? message } catch { /* Use the original error. */ }
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(String(data.error))
  return data as { message: string }
}
