import { useState, type FormEvent } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { employeeName, employeeSelect } from '../../lib/team-management'
import { runAdminAction } from '../../lib/admin-api'
import type { JsonRecord } from '../../lib/database.types'
import { PortalError, PortalLoading } from './AsyncState'

export default function ContactAssignmentPanel({ record, onSaved }: { record: JsonRecord; onSaved: () => Promise<void> }) {
  const { previewMode } = useAuth()
  const employees = usePortalRows('employees', { select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 1000 })
  const [owner, setOwner] = useState(String(record.assigned_employee_id ?? ''))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setError(null); setMessage(null)
    if (previewMode) { setMessage('Local preview only — no customer ownership was changed.'); return }
    const name = employees.rows.find(person => person.id === owner)?.display_name
    if (!window.confirm(`Transfer ${String(record.display_name)} and their open work to ${String(name)}? Completed sales and contract history will keep their original attribution.`)) return
    setPending(true)
    try {
      await runAdminAction({ action: 'reassign_contact', contact_id: record.id, employee_id: owner, expected_owner_id: record.assigned_employee_id ?? null })
      setMessage('Customer ownership and open work transferred.')
      await onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Transfer failed. Please retry.') }
    finally { setPending(false) }
  }
  return <form className="workspace-card record-action-form" onSubmit={submit}><div className="workspace-card-heading"><div><span>ADMIN / OWNERSHIP</span><h3>Assign customer</h3></div><ArrowRightLeft size={20} /></div>
    <p className="team-helper">Current owner: <strong>{employeeName(record)}</strong></p>
    {employees.loading ? <PortalLoading label="Loading employees" /> : employees.error ? <PortalError message={employees.error} retry={() => void employees.reload()} /> : <label><span>New owner</span><select required value={owner} onChange={e => setOwner(e.target.value)}><option value="">Choose an active employee</option>{employees.rows.filter(person => person.active).map(person => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)} · {String(person.rep_code)}</option>)}</select></label>}
    <p className="team-helper">Transfers active leads, open deals, open follow-ups, and draft/sent quotes on open deals together. Closed deals, contracts, completed tasks, and sold units retain their history.</p>
    {error ? <PortalError message={error} /> : null}{message ? <p role="status" className="record-action-message">{message}</p> : null}
    <button type="submit" className="portal-secondary-button" disabled={pending || !owner || owner === record.assigned_employee_id || employees.loading || Boolean(employees.error)}>{pending ? 'Transferring…' : 'Transfer customer & open work'}</button>
  </form>
}
