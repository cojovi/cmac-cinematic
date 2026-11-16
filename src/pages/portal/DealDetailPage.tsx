import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, CalendarClock, CheckCircle2, CircleDollarSign, History, MessageSquarePlus, PauseCircle, Pencil, PlayCircle, Plus, ReceiptText, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor, useNow } from '../../hooks/useCrm'
import { useToast } from '../../hooks/useToast'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { ActivityComposer } from '../../components/crm/ActivityComposer'
import { ConfirmDialog, Dialog, ReasonDialog } from '../../components/crm/Dialog'
import { FollowUpCard } from '../../components/crm/FollowUps'
import { Timeline } from '../../components/crm/Timeline'
import { Badge, ContactActions, DealStageBadge, Empty, Owner, StatusBadge } from '../../components/crm/primitives'
import { addDealUnit, closeDealLost, completeSale, createQuote, removeDealUnit, reopenDeal, updateDeal } from '../../lib/crm/api'
import { contactOf } from '../../lib/crm/links'
import { dealStage, dealValue, formatMoney, formatMoneyExact, isOpenDeal, relativeTime, toNumber, workingDealStages, type DealStage } from '../../lib/crm/pipeline'
import { activitySelect, employeeSelect, formatRecordDate } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const dealSelect = '*,contacts(id,display_name,email,phone,company),owner:employees!deals_sales_rep_id_fkey(id,display_name,rep_code)'
const taskSelect = '*,contacts(display_name),owner:employees!tasks_employee_id_fkey(id,display_name)'

function CommercialsForm({ deal, onDone }: { deal: JsonRecord; onDone: () => void }) {
  const { run, busy } = useAction()
  const [form, setForm] = useState(() => ({
    project_name: String(deal.project_name ?? ''), project_address: String(deal.project_address ?? ''),
    base_amount: String(toNumber(deal.base_amount)), delivery_amount: String(toNumber(deal.delivery_amount)),
    deposit_percent: String(toNumber(deal.deposit_percent)), delivery_estimate: String(deal.delivery_estimate ?? ''), notes: String(deal.notes ?? ''),
  }))
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const saved = await run(() => updateDeal(String(deal.id), {
      project_name: form.project_name.trim() || null, project_address: form.project_address.trim() || null,
      base_amount: Number(form.base_amount), delivery_amount: Number(form.delivery_amount), deposit_percent: Number(form.deposit_percent),
      delivery_estimate: form.delivery_estimate.trim() || null, notes: form.notes.trim() || null,
    }), 'Deal updated.')
    if (saved) onDone()
  }

  return (
    <form className="crm-form" onSubmit={submit}>
      <div className="crm-form-grid">
        <label className="crm-field wide"><span>Project name</span><input value={form.project_name} onChange={set('project_name')} maxLength={200} /></label>
        <label className="crm-field wide"><span>Project / delivery address</span><input value={form.project_address} onChange={set('project_address')} maxLength={240} /></label>
        <label className="crm-field"><span>Base price (USD)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.base_amount} onChange={set('base_amount')} required /></label>
        <label className="crm-field"><span>Delivery (USD)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.delivery_amount} onChange={set('delivery_amount')} required /></label>
        <label className="crm-field"><span>Deposit %</span><input type="number" min="0" max="100" step="0.5" inputMode="decimal" value={form.deposit_percent} onChange={set('deposit_percent')} required /></label>
        <label className="crm-field"><span>Delivery estimate</span><input value={form.delivery_estimate} onChange={set('delivery_estimate')} maxLength={120} placeholder="6–8 weeks" /></label>
        <label className="crm-field wide"><span>Notes</span><textarea rows={4} value={form.notes} onChange={set('notes')} maxLength={4000} /></label>
      </div>
      <div className="crm-form-actions"><button className="crm-btn ghost" type="button" onClick={onDone}>Cancel</button><button className="crm-btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save deal'}</button></div>
    </form>
  )
}

export default function DealDetailPage() {
  const { dealId = '' } = useParams()
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const toast = useToast()
  const byDeal = { column: 'deal_id', value: dealId }
  const deal = useCrmRows('deals', { select: dealSelect, filter: { column: 'id', value: dealId } })
  const activities = useCrmRows('activities', { select: activitySelect, filter: byDeal, orderBy: 'created_at', limit: 200 })
  const tasks = useCrmRows('tasks', { select: taskSelect, filter: byDeal, orderBy: 'due_at', ascending: true, limit: 200 })
  const units = useCrmRows('deal_units', { filter: byDeal, orderBy: 'created_at', ascending: true, limit: 100 })
  const quotes = useCrmRows('quotes', { filter: byDeal, orderBy: 'created_at', limit: 50 })
  const contracts = useCrmRows('contracts', { filter: byDeal, orderBy: 'created_at', limit: 50 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(deal, activities, tasks, units, quotes, contracts)
  const { run, busy } = useAction()
  const [dialog, setDialog] = useState<'edit' | 'lost' | 'sold' | null>(null)
  const [unitId, setUnitId] = useState('')
  const [productType, setProductType] = useState('Mini Home')
  const [overrideReason, setOverrideReason] = useState('')

  if (page.loading) return <PortalLoading label="Opening deal" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />
  const record = deal.rows[0]
  if (!record) return <PortalEmpty title="Deal not found" copy="It may have been transferred, or it is outside the records you can access." />

  const contact = contactOf(record)
  const customer = String(contact.display_name ?? 'Customer')
  const number = String(record.deal_number)
  const open = isOpenDeal(record)
  const stage = String(record.stage) as DealStage
  const stageIndex = workingDealStages.indexOf(stage)
  const total = dealValue(record)
  const deposit = total * toNumber(record.deposit_percent) / 100
  const target = { contactId: record.contact_id ? String(record.contact_id) : null, leadId: record.lead_id ? String(record.lead_id) : null, dealId, ownerId: record.sales_rep_id ? String(record.sales_rep_id) : null }
  const confirmedUnits = units.rows.filter((unit) => unit.source !== 'mock' && unit.confirmed_at)
  const unitsReady = units.rows.length > 0 && confirmedUnits.length === units.rows.length
  const contractDone = contracts.rows.some((contract) => contract.status === 'completed')
  const overrideOk = actor.isAdmin && overrideReason.trim().length >= 10
  const canSell = open && unitsReady && (contractDone || overrideOk)

  async function addUnit(event: FormEvent) {
    event.preventDefault()
    if (await run(() => addDealUnit(actor, dealId, unitId, productType), 'Unit added and confirmed.')) setUnitId('')
  }

  async function newQuote() {
    await run(async () => { navigate(`/employee-portal/quotes/${await createQuote(actor, record)}`) }, 'Draft quote created.')
  }

  return (
    <section className="crm-page" aria-labelledby="deal-heading">
      <Link className="crm-back" to="/employee-portal/deals"><ArrowLeft size={14} />Deals</Link>
      <div className="crm-record-head">
        <div className="crm-record-title">
          <div>
            <span className="crm-eyebrow">DEAL / {number}</span>
            <h2 id="deal-heading">{String(record.project_name ?? number)}</h2>
            <div className="crm-record-sub">
              <DealStageBadge stage={stage} status={record.status} />
              {record.contact_id ? <Link to={`/employee-portal/customers/${String(record.contact_id)}`}>{customer}</Link> : null}
              <strong style={{ color: 'var(--text)' }}>{formatMoney(total)}</strong>
              <span>Updated {relativeTime(record.updated_at, now)}</span>
            </div>
          </div>
          <div className="crm-record-actions">
            <ContactActions name={customer} phone={contact.phone} email={contact.email} />
            {open ? <button className="crm-btn" type="button" onClick={() => setDialog('edit')}><Pencil size={14} />Edit deal</button> : null}
            {open ? <button className="crm-btn" type="button" disabled={busy} onClick={() => void run(() => updateDeal(dealId, { status: record.status === 'on_hold' ? 'open' : 'on_hold' }), record.status === 'on_hold' ? 'Deal resumed.' : 'Deal placed on hold.')}>{record.status === 'on_hold' ? <><PlayCircle size={14} />Resume</> : <><PauseCircle size={14} />Hold</>}</button> : null}
            {open ? <button className="crm-btn" type="button" onClick={() => setDialog('lost')}><XCircle size={14} />Mark lost</button> : null}
            {record.status === 'lost' ? <button className="crm-btn" type="button" disabled={busy} onClick={() => void run(() => reopenDeal(record), 'Deal reopened in Negotiation.')}><RotateCcw size={14} />Reopen</button> : null}
            {open ? <button className="crm-btn primary" type="button" disabled={busy} onClick={() => void newQuote()}><ReceiptText size={15} />New quote</button> : null}
          </div>
        </div>
        {open ? (
          <ol className="crm-stepper" aria-label="Deal stage">
            {workingDealStages.map((step, index) => {
              const def = dealStage(step)
              return (
                <li key={step} className={stage === step ? 'current' : stageIndex > index ? 'done' : undefined}>
                  <button type="button" disabled={busy || stage === step} aria-current={stage === step ? 'step' : undefined} onClick={() => void run(() => updateDeal(dealId, { stage: step }), `${number} moved to ${def.label}.`)}>{def.label}<small>{def.hint}</small></button>
                </li>
              )
            })}
          </ol>
        ) : <div className={record.status === 'won' ? 'crm-banner info' : 'crm-banner'}>{record.status === 'won' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<span><strong>{record.status === 'won' ? 'Sold.' : `Closed — ${String(record.status)}.`}</strong> {record.closed_at ? `Closed ${formatRecordDate(record.closed_at)}.` : ''} {record.status === 'won' ? 'Unit attribution is permanent.' : 'The reason is on the timeline.'}</span></div>}
      </div>

      <div className="crm-record-grid">
        <div className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">LOG ACTIVITY</span><h3>What just happened?</h3></div><MessageSquarePlus size={18} /></div>
            <ActivityComposer target={target} subject={customer} />
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">TIMELINE</span><h3>History</h3></div><History size={18} /></div>
            <Timeline rows={activities.rows} now={now} />
          </article>
        </div>
        <aside className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">NEXT STEP</span><h3>Follow-ups</h3></div><CalendarClock size={18} /></div>
            <FollowUpCard tasks={tasks.rows} now={now} target={target} subject={customer} employees={employees.rows} />
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">COMMERCIALS</span><h3>Price and terms</h3></div><CircleDollarSign size={18} /></div>
            <dl className="crm-facts">
              <div><dt>Base price</dt><dd>{formatMoneyExact(record.base_amount)}</dd></div>
              <div><dt>Delivery</dt><dd>{formatMoneyExact(record.delivery_amount)}</dd></div>
              <div><dt>Total</dt><dd><strong>{formatMoneyExact(total)}</strong></dd></div>
              <div><dt>Deposit</dt><dd>{toNumber(record.deposit_percent)}% · {formatMoneyExact(deposit)}</dd></div>
              <div><dt>Delivery estimate</dt><dd>{String(record.delivery_estimate ?? '—')}</dd></div>
              <div><dt>Sales rep</dt><dd><Owner row={record} idField="sales_rep_id" /></dd></div>
              <div className="wide"><dt>Project address</dt><dd>{String(record.project_address ?? '—')}</dd></div>
              <div className="wide"><dt>Notes</dt><dd>{String(record.notes ?? '—')}</dd></div>
            </dl>
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">UNITS</span><h3>What is being sold</h3></div><Boxes size={18} /></div>
            {units.rows.length ? (
              <ul className="crm-linklist">{units.rows.map((unit) => (
                <li key={String(unit.id)}><div className="crm-card-link">
                  <span><strong>{String(unit.external_unit_id)}</strong><small>{String(unit.external_product_type)}</small></span>
                  {unit.source === 'mock' ? <Badge tone="warn">Model reference</Badge> : unit.confirmed_at ? <Badge tone="good">Confirmed</Badge> : <Badge tone="warn">Unconfirmed</Badge>}
                  {open ? <button className="crm-icon-btn" type="button" disabled={busy} onClick={() => void run(() => removeDealUnit(String(unit.id)), 'Unit removed.')} aria-label={`Remove unit ${String(unit.external_unit_id)}`} title="Remove"><Trash2 size={13} /></button> : null}
                </div></li>
              ))}</ul>
            ) : <Empty title="No units on this deal" />}
            {open ? (
              <form className="crm-composer-row" onSubmit={addUnit} style={{ marginTop: 12 }}>
                <input className="crm-input" style={{ flex: '1 1 120px' }} value={unitId} onChange={(event) => setUnitId(event.target.value)} placeholder="Real unit / job ID" aria-label="Real unit or job ID" required maxLength={80} />
                <input className="crm-input" style={{ flex: '1 1 120px' }} value={productType} onChange={(event) => setProductType(event.target.value)} placeholder="Product type" aria-label="Product type" required maxLength={80} />
                <button className="crm-btn" type="submit" disabled={busy}><Plus size={14} />Confirm unit</button>
              </form>
            ) : null}
            {open && units.rows.some((unit) => unit.source === 'mock') ? <p className="crm-card-foot">Model references are for planning. Add the verified unit ID, then remove the model reference before marking the deal sold.</p> : null}
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">QUOTES</span><h3>Pricing sent to the customer</h3></div><ReceiptText size={18} /></div>
            {quotes.rows.length ? <ul className="crm-linklist">{quotes.rows.map((quote) => <li key={String(quote.id)}><Link className="crm-card-link" to={`/employee-portal/quotes/${String(quote.id)}`}><span><strong>{String(quote.quote_number)}</strong><small>{formatMoney(quote.total)} · updated {relativeTime(quote.updated_at, now)}</small></span><StatusBadge value={quote.status} /></Link></li>)}</ul> : <Empty title="No quotes yet">Use New quote to draft one from this deal’s pricing.</Empty>}
          </article>
          {open ? (
            <article className="crm-card">
              <div className="crm-card-head"><div><span className="crm-eyebrow">CLOSE / FINAL</span><h3>Mark deal sold</h3></div><CheckCircle2 size={18} /></div>
              <dl className="crm-facts">
                <div><dt>Confirmed units</dt><dd>{confirmedUnits.length} / {units.rows.length}</dd></div>
                <div><dt>Completed contracts</dt><dd>{contracts.rows.filter((contract) => contract.status === 'completed').length}</dd></div>
              </dl>
              {actor.isAdmin && !contractDone ? <label className="crm-field" style={{ marginTop: 12 }}><span>Admin override reason</span><textarea rows={2} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} maxLength={500} aria-describedby="override-hint" /></label> : null}
              {actor.isAdmin && !contractDone ? <p className="crm-hint" id="override-hint">Contract signing is not live yet. An administrator can close the sale with a reason of at least 10 characters.</p> : null}
              <p className="crm-card-foot">{!unitsReady ? 'Every unit needs a confirmed, non-model reference.' : !contractDone && !actor.isAdmin ? 'A completed contract is required, or an administrator can close this sale with a recorded reason.' : !contractDone && !overrideOk ? 'Enter the override reason to continue.' : 'Ready. This creates permanent unit-sale records and cannot be undone from the portal.'}</p>
              <button className="crm-btn primary" type="button" style={{ marginTop: 12, width: '100%' }} disabled={!canSell || busy} onClick={() => setDialog('sold')}><CheckCircle2 size={15} />Mark sold</button>
            </article>
          ) : null}
        </aside>
      </div>

      {dialog === 'edit' ? <Dialog title={`Edit ${number}`} eyebrow="DEAL / COMMERCIALS" variant="drawer" onClose={() => setDialog(null)}><CommercialsForm deal={record} onDone={() => setDialog(null)} /></Dialog> : null}
      {dialog === 'lost' ? <ReasonDialog title={`Close ${number} as lost?`} body="The deal leaves the open pipeline. The reason is added to its timeline." label="Why was it lost?" confirmLabel="Mark lost" busy={busy} onClose={() => setDialog(null)} onConfirm={(reason) => void run(() => closeDealLost(actor, record, reason), `${number} closed as lost.`).then((ok) => { if (ok) setDialog(null) })} /> : null}
      {dialog === 'sold' ? <ConfirmDialog title={`Mark ${number} sold?`} body={`This records ${units.rows.length} permanent unit sale${units.rows.length === 1 ? '' : 's'} attributed to the deal’s sales rep and marks ${customer} as a customer. It cannot be reversed from the portal.`} confirmLabel="Mark sold" busy={busy} onClose={() => setDialog(null)} onConfirm={() => void run(async () => { toast.success(await completeSale(actor, record, overrideReason)) }).then(() => setDialog(null))} /> : null}
    </section>
  )
}
