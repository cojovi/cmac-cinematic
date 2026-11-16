import { useState, type FormEvent } from 'react'
import type { JsonRecord } from '../../lib/database.types'
import { createContact, updateContact, type ContactInput } from '../../lib/crm/api'
import { useAction, useActor } from '../../hooks/useCrm'

const lifecycleStages = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'inactive', label: 'Inactive' },
]

function initial(record?: JsonRecord): ContactInput {
  const text = (key: string) => String(record?.[key] ?? '')
  return {
    first_name: text('first_name'), last_name: text('last_name'), email: text('email'), phone: text('phone'), company: text('company'),
    project_address: text('project_address'), billing_address: text('billing_address'), city: text('city'), state: text('state'),
    postal_code: text('postal_code'), lifecycle_stage: text('lifecycle_stage') || 'lead',
  }
}

export function ContactForm({ record, onSaved, onCancel }: { record?: JsonRecord; onSaved: (id: string) => void; onCancel: () => void }) {
  const actor = useActor()
  const { run, busy } = useAction()
  const [form, setForm] = useState<ContactInput>(() => initial(record))
  const set = (key: keyof ContactInput) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    let id = record ? String(record.id) : ''
    const saved = await run(async () => {
      if (record) await updateContact(id, form)
      else id = await createContact(actor, form)
    }, record ? 'Customer details saved.' : 'Customer created.')
    if (saved) onSaved(id)
  }

  return (
    <form className="crm-form" onSubmit={submit}>
      <div className="crm-form-grid">
        <label className="crm-field"><span>First name *</span><input value={form.first_name} onChange={set('first_name')} required maxLength={80} autoComplete="off" autoFocus={!record} /></label>
        <label className="crm-field"><span>Last name</span><input value={form.last_name} onChange={set('last_name')} maxLength={80} autoComplete="off" /></label>
        <label className="crm-field"><span>Email *</span><input type="email" value={form.email} onChange={set('email')} required maxLength={254} autoComplete="off" aria-describedby="contact-email-hint" /></label>
        <label className="crm-field"><span>Phone</span><input type="tel" value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="off" /></label>
        <label className="crm-field"><span>Company</span><input value={form.company} onChange={set('company')} maxLength={160} autoComplete="off" /></label>
        <label className="crm-field"><span>Lifecycle</span><select value={form.lifecycle_stage} onChange={set('lifecycle_stage')}>{lifecycleStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select></label>
        <label className="crm-field wide"><span>Project / delivery address</span><input value={form.project_address} onChange={set('project_address')} maxLength={240} autoComplete="off" /></label>
        <label className="crm-field"><span>City</span><input value={form.city} onChange={set('city')} maxLength={120} autoComplete="off" /></label>
        <div className="crm-form-grid" style={{ gap: 12 }}>
          <label className="crm-field"><span>State</span><input value={form.state} onChange={set('state')} maxLength={40} autoComplete="off" /></label>
          <label className="crm-field"><span>ZIP</span><input value={form.postal_code} onChange={set('postal_code')} maxLength={20} autoComplete="off" /></label>
        </div>
        <label className="crm-field wide"><span>Billing address</span><input value={form.billing_address} onChange={set('billing_address')} maxLength={240} autoComplete="off" /></label>
      </div>
      <p className="crm-hint" id="contact-email-hint">Email is the customer’s unique identity across leads, deals, and quotes.{!record ? ` The new customer is assigned to you.${actor.isAdmin ? ' Transfer ownership from the customer record afterwards.' : ''}` : ''}</p>
      <div className="crm-form-actions">
        <button className="crm-btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="crm-btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : record ? 'Save details' : 'Create customer'}</button>
      </div>
    </form>
  )
}
