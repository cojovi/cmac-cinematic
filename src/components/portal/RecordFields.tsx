import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { JsonRecord } from '../../lib/database.types'
import { employeeName, formatRecordDate, related } from '../../lib/team-management'
import { useAuth } from '../../auth/useAuth'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const human = (value: unknown) => value == null || value === '' ? '—' : String(value).replaceAll('_', ' ')

export default function RecordFields({ record, resource, deals }: { record: JsonRecord; resource: 'customers' | 'leads' | 'deals'; deals: JsonRecord[] }) {
  const { employee } = useAuth()
  const contact = related(record, 'contacts') ?? record
  const ownerKey = resource === 'deals' ? 'sales_rep_id' : 'assigned_employee_id'
  const details: [string, unknown][] = resource === 'customers' ? [
    ['Name',record.display_name], ['Email',record.email], ['Phone',record.phone], ['Company',record.company],
    ['Project address',record.project_address], ['Billing address',record.billing_address],
    ['City / state',[record.city,record.state,record.postal_code].filter(Boolean).join(', ')], ['Lifecycle',human(record.lifecycle_stage)],
  ] : resource === 'leads' ? [
    ['Customer',contact.display_name], ['Email',contact.email], ['Phone',contact.phone],
    ['Project type',record.project_type], ['Project location',record.project_location], ['Ideal timing',record.desired_timing],
    ['Source',human(record.source)], ['Pipeline status',human(record.status)], ['Summary',record.summary], ['Lost reason',record.lost_reason],
  ] : [
    ['Deal number',record.deal_number], ['Customer',contact.display_name], ['Project',record.project_name], ['Project address',record.project_address],
    ['Stage',human(record.stage)], ['Status',human(record.status)], ['Base price',money.format(Number(record.base_amount ?? 0))],
    ['Delivery',money.format(Number(record.delivery_amount ?? 0))], ['Deposit',`${Number(record.deposit_percent ?? 0)}%`], ['Notes',record.notes],
  ]
  const identity = (label: string, field: string, relation: string) => <div key={field}><dt>{label}</dt><dd>{record[field] && employee?.role === 'admin' ? <Link to={`/employee-portal/admin/employees?employee=${String(record[field])}`}>{employeeName(record, relation, field)}</Link> : employeeName(record, relation, field)}</dd></div>
  return <article className="workspace-card record-fields"><div className="workspace-card-heading"><div><span>RECORD / DETAILS</span><h3>Current information</h3></div><FileText size={20} /></div>
    <dl>{details.map(([label,value]) => <div key={label} className={label === 'Summary' || label === 'Notes' ? 'record-note-field' : undefined}><dt>{label}</dt><dd>{value == null || value === '' ? '—' : String(value)}</dd></div>)}
      {identity('Assigned employee',ownerKey,'owner')}
      {resource === 'customers' ? identity('Created by','created_by','creator') : null}
      <div><dt>Created</dt><dd>{formatRecordDate(record.created_at)}</dd></div><div><dt>Last updated</dt><dd>{formatRecordDate(record.updated_at)}</dd></div>
    </dl>
    <div className="record-related-links">{resource !== 'customers' && record.contact_id ? <Link to={`/employee-portal/customers/${String(record.contact_id)}`}>Open customer ↗</Link> : null}{deals.map(deal => <Link key={String(deal.id)} to={`/employee-portal/deals/${String(deal.id)}`}>Deal {String(deal.deal_number)} ↗</Link>)}</div>
  </article>
}
