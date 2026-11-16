import { useState, type FormEvent } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { useCrmRows } from '../../hooks/useCrmRows'
import { useAction } from '../../hooks/useCrm'
import { transferContact } from '../../lib/crm/api'
import { employeeName, employeeSelect } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'
import { ConfirmDialog } from '../crm/Dialog'

/** Administrator-only ownership transfer. Moves the customer and their open work in one audited server transaction. */
export default function ContactAssignmentPanel({ record }: { record: JsonRecord }) {
  const employees = useCrmRows('employees', { select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const { run, busy } = useAction()
  const [owner, setOwner] = useState(String(record.assigned_employee_id ?? ''))
  const [confirming, setConfirming] = useState(false)
  const target = employees.rows.find((person) => person.id === owner)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (owner && owner !== record.assigned_employee_id) setConfirming(true)
  }

  return (
    <form className="crm-form" onSubmit={submit}>
      <p className="crm-muted" style={{ margin: 0, fontSize: 12.5 }}>Current owner: <strong style={{ color: 'var(--text)' }}>{employeeName(record)}</strong></p>
      <label className="crm-field"><span>New owner</span>
        <select required value={owner} disabled={employees.loading} onChange={(event) => setOwner(event.target.value)}>
          <option value="">Choose an active employee</option>
          {employees.rows.filter((person) => person.active).map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)} · {String(person.rep_code)}</option>)}
        </select>
      </label>
      <p className="crm-hint">Moves active leads, open deals, open follow-ups, and draft/sent quotes on open deals. Closed deals, contracts, and sold units keep their history.</p>
      {employees.error ? <p className="crm-form-error">{employees.error}</p> : null}
      <button className="crm-btn" type="submit" disabled={busy || !owner || owner === record.assigned_employee_id}><ArrowRightLeft size={14} />{busy ? 'Transferring…' : 'Transfer customer & open work'}</button>
      {confirming ? <ConfirmDialog title="Transfer this customer?" body={`${String(record.display_name)} and their open work will move to ${String(target?.display_name ?? 'the selected employee')}. Completed sales and contract history keep their original attribution.`} confirmLabel="Transfer" busy={busy} onClose={() => setConfirming(false)} onConfirm={() => void run(() => transferContact(record, owner), 'Customer ownership and open work transferred.').then(() => setConfirming(false))} /> : null}
    </form>
  )
}
