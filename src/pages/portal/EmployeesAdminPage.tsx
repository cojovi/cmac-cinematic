import { useState, type FormEvent } from 'react'
import { ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { usePortalRows } from '../../hooks/usePortalRows'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'
import { ConfigurationState, PortalError, PortalLoading } from '../../components/portal/AsyncState'

export default function EmployeesAdminPage() {
  const { previewMode } = useAuth()
  const employees = usePortalRows('employees', { orderBy: 'display_name', ascending: true, limit: 250 })
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'sales_rep' })
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function createEmployee(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null)
    if (previewMode || !supabase) { setMessage('Local preview only — no allowlist record was created.'); return }
    const { data, error: functionError } = await supabase.functions.invoke('admin-manage-employee', { body: { action: 'create', employee: { ...form, display_name: `${form.first_name} ${form.last_name}`.trim() } } })
    if (functionError) setError(functionError.message); else { setMessage(String((data as { message?: string })?.message ?? 'Employee added.')); await employees.reload() }
  }

  async function toggleEmployee(id: string, active: boolean, name: string) {
    if (previewMode || !supabase) return
    if (!window.confirm(`${active ? 'Deactivate' : 'Reactivate'} ${name}? Access changes take effect on the next RLS check.`)) return
    const { error: functionError } = await supabase.functions.invoke('admin-manage-employee', { body: { action: active ? 'deactivate' : 'activate', employee_id: id } })
    if (functionError) setError(functionError.message); else await employees.reload()
  }

  if (employees.loading) return <PortalLoading label="Loading employee allowlist" />
  if (employees.error) return <PortalError message={employees.error} />
  return <section className="portal-library-view" aria-labelledby="employees-heading"><div className="workspace-view-heading"><div><span>ADMIN / IDENTITY ALLOWLIST</span><h2 id="employees-heading">Employee access</h2><p>Google sign-in succeeds only for active @cmaccontainers.com identities already listed here.</p></div><span className="workspace-live-chip"><UsersRound size={14} /> {employees.rows.filter((row) => row.active).length} active</span></div>{previewMode ? <ConfigurationState service="Local preview" copy="Employee access mutations require an authenticated production admin." /> : null}{message ? <p className="record-action-message">{message}</p> : null}{error ? <PortalError message={error} /> : null}<div className="admin-grid"><form className="workspace-card record-action-form" onSubmit={createEmployee}><div className="workspace-card-heading"><div><span>ALLOWLIST / NEW</span><h3>Add employee</h3></div><UserPlus size={20} /></div><div className="admin-form-grid"><label><span>First name</span><input value={form.first_name} onChange={(event) => setForm((value) => ({ ...value, first_name: event.target.value }))} required /></label><label><span>Last name</span><input value={form.last_name} onChange={(event) => setForm((value) => ({ ...value, last_name: event.target.value }))} required /></label><label className="field-wide"><span>CMAC email</span><input type="email" pattern=".+@cmaccontainers\.com" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} required /></label><label className="field-wide"><span>Role</span><select value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))}><option value="sales_rep">Sales representative</option><option value="admin">Administrator</option></select></label></div><button className="portal-primary-button" disabled={previewMode} type="submit"><ShieldCheck size={15} /> Add to allowlist</button></form><div className="employee-register">{employees.rows.map((employee) => <article key={String(employee.id)}><span className="customer-initials">{String(employee.display_name).split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{String(employee.display_name)}</strong><small>{String(employee.email)} · {String(employee.rep_code)}</small></div><span className={`status-pill ${employee.active ? 'status-completed' : 'status-cancelled'}`}>{employee.active ? 'Active' : 'Inactive'}</span><span>{String(employee.role).replace('_', ' ')}</span><button className="portal-secondary-button" disabled={previewMode} type="button" onClick={() => void toggleEmployee(String(employee.id), Boolean(employee.active), String(employee.display_name))}>{employee.active ? 'Deactivate' : 'Reactivate'}</button></article>)}</div></div></section>
}
