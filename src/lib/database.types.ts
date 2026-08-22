/**
 * Database-facing row types generated from the migration contract.
 * Regenerate after linked schema changes with:
 * `supabase gen types typescript --project-id <project-ref>`.
 */
export type EmployeeRole = 'admin' | 'sales_rep'

export interface EmployeeRow {
  id: string
  auth_user_id: string | null
  email: string
  first_name: string
  last_name: string
  display_name: string
  role: EmployeeRole
  rep_code: string
  phone: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ContactRow {
  id: string
  first_name: string
  last_name: string
  display_name: string
  email: string
  phone: string | null
  company: string | null
  project_address: string | null
  billing_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  lifecycle_stage: 'lead' | 'prospect' | 'customer' | 'inactive'
  assigned_employee_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeadRow {
  id: string
  contact_id: string
  assigned_employee_id: string | null
  source: string
  status: 'new' | 'contacted' | 'nurturing' | 'qualified' | 'converted' | 'lost' | 'archived'
  project_type: string | null
  project_location: string | null
  desired_timing: string | null
  summary: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
  converted_at: string | null
}

export interface InventorySummary {
  available_inventory: number
  allocated_boss: number
  last_synced_at: string
}

export type JsonRecord = Record<string, unknown>
