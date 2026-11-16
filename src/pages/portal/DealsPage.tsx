import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, Columns3, Download, Plus, Rows3, Search, XCircle } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor, useNow } from '../../hooks/useCrm'
import { useSort } from '../../hooks/useSort'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { ReasonDialog } from '../../components/crm/Dialog'
import { Kanban } from '../../components/crm/Kanban'
import { SortHeader } from '../../components/crm/SortHeader'
import { DealStageBadge, Empty, Owner, Segmented, SelectFilter } from '../../components/crm/primitives'
import { closeDealLost, updateDeal } from '../../lib/crm/api'
import { csvFilename, downloadCsv } from '../../lib/crm/csv'
import { contactOf } from '../../lib/crm/links'
import { buildSignals, dealStage, dealStages, dealValue, dueLabel, formatDate, formatMoney, isOpenDeal, matchesSearch, relativeTime, weightedDealValue, workingDealStages, type DealStage } from '../../lib/crm/pipeline'
import { employeeSelect } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const dealSelect = '*,contacts(display_name,email,phone),owner:employees!deals_sales_rep_id_fkey(id,display_name,rep_code)'
type SortKey = 'number' | 'customer' | 'stage' | 'value' | 'owner' | 'updated' | 'next'

export default function DealsPage() {
  const actor = useActor()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'table' ? 'table' : 'board'
  const owner = actor.isAdmin ? params.get('owner') ?? 'all' : 'all'
  const deals = useCrmRows('deals', { select: dealSelect, orderBy: 'updated_at', limit: 1000 })
  const tasks = useCrmRows('tasks', { select: 'id,deal_id,due_at,status', filter: { column: 'status', value: 'open' }, limit: 1000 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(deals, tasks)
  const { run, busy } = useAction()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'open' | 'won' | 'lost' | 'all'>('open')
  const [losing, setLosing] = useState<JsonRecord | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const query = useDeferredValue(search)

  const signals = useMemo(() => buildSignals('deal_id', [], tasks.rows, now), [now, tasks.rows])
  const base = useMemo(() => deals.rows.filter((deal) => {
    if (owner !== 'all' && deal.sales_rep_id !== owner) return false
    return matchesSearch([deal.deal_number, deal.project_name, deal.project_address, contactOf(deal).display_name, contactOf(deal).email], query)
  }), [deals.rows, owner, query])
  const open = base.filter(isOpenDeal)
  const won = base.filter((deal) => deal.status === 'won')
  const lost = base.filter((deal) => deal.status === 'lost' || deal.status === 'cancelled')
  const tableRows = scope === 'open' ? open : scope === 'won' ? won : scope === 'lost' ? lost : base
  const accessors = useMemo(() => ({
    number: (deal: JsonRecord) => String(deal.deal_number ?? ''),
    customer: (deal: JsonRecord) => String(contactOf(deal).display_name ?? ''),
    stage: (deal: JsonRecord) => dealStages.findIndex((stage) => stage.value === deal.stage),
    value: (deal: JsonRecord) => -dealValue(deal),
    owner: (deal: JsonRecord) => String((deal.owner as JsonRecord | null)?.display_name ?? ''),
    updated: (deal: JsonRecord) => String(deal.updated_at ?? ''),
    next: (deal: JsonRecord) => signals.get(deal.id).nextTaskDue,
  }), [signals])
  const table = useSort<JsonRecord, SortKey>(tableRows, accessors, { key: 'updated', direction: 'desc' })

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  async function move(deal: JsonRecord, target: string) {
    if (target === 'closed_lost') { setLosing(deal); return }
    const id = String(deal.id)
    setPendingIds((current) => new Set(current).add(id))
    await run(() => updateDeal(id, { stage: target as DealStage }), `${String(deal.deal_number)} moved to ${dealStage(target).label}.`)
    setPendingIds((current) => { const next = new Set(current); next.delete(id); return next })
  }

  function exportCsv() {
    downloadCsv(csvFilename('deals'), view === 'table' ? table.sorted : base, [
      { header: 'Deal', value: (deal) => deal.deal_number },
      { header: 'Customer', value: (deal) => contactOf(deal).display_name },
      { header: 'Project', value: (deal) => deal.project_name },
      { header: 'Stage', value: (deal) => dealStage(deal.stage).label },
      { header: 'Status', value: (deal) => deal.status },
      { header: 'Base amount', value: (deal) => deal.base_amount },
      { header: 'Delivery', value: (deal) => deal.delivery_amount },
      { header: 'Total', value: (deal) => dealValue(deal) },
      { header: 'Deposit %', value: (deal) => deal.deposit_percent },
      { header: 'Sales rep', value: (deal) => (deal.owner as JsonRecord | null)?.display_name },
      { header: 'Created', value: (deal) => formatDate(deal.created_at) },
      { header: 'Closed', value: (deal) => formatDate(deal.closed_at) },
    ])
  }

  if (page.loading) return <PortalLoading label="Loading deals" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const pipeline = open.reduce((sum, deal) => sum + dealValue(deal), 0)
  const weighted = open.reduce((sum, deal) => sum + weightedDealValue(deal), 0)
  const wonValue = won.reduce((sum, deal) => sum + dealValue(deal), 0)

  function card(deal: JsonRecord) {
    const signal = signals.get(deal.id)
    const number = String(deal.deal_number)
    return (
      <>
        <div className="crm-kanban-card-top"><Link to={`/employee-portal/deals/${String(deal.id)}`}>{number}</Link><strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(dealValue(deal))}</strong></div>
        <p>{[contactOf(deal).display_name, deal.project_name].filter(Boolean).join(' · ')}</p>
        <div className="crm-kanban-meta">
          <span>Updated {relativeTime(deal.updated_at, now)}</span>
          {deal.status === 'on_hold' ? <span className="warn">On hold</span> : null}
          {signal.nextTaskDue ? <span className={signal.overdueTasks ? 'bad' : undefined}><CalendarClock size={12} />{dueLabel(signal.nextTaskDue, now)}</span> : <span className="warn">No next step</span>}
        </div>
        <div className="crm-kanban-foot">
          <Owner row={deal} idField="sales_rep_id" compact />
          <select className="crm-move" value="" disabled={pendingIds.has(String(deal.id))} onChange={(event) => { if (event.target.value) void move(deal, event.target.value) }} aria-label={`Move ${number}`}>
            <option value="">Move…</option>
            {workingDealStages.filter((stage) => stage !== deal.stage).map((stage) => <option key={stage} value={stage}>{dealStage(stage).label}</option>)}
            <option value="closed_lost">Mark lost</option>
          </select>
        </div>
      </>
    )
  }

  return (
    <section className="crm-page" aria-labelledby="deals-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">SALES / DEAL PIPELINE</span><h2 id="deals-heading">Deal workspace</h2><p>Every sale in motion, by stage and value. Winning a deal happens from its record, where unit attribution is confirmed.</p></div>
        <div className="crm-header-actions">
          <Segmented label="Deal view" value={view} onChange={(next) => setParam('view', next === 'board' ? null : next)} options={[{ value: 'board', label: 'Board', icon: <Columns3 size={14} /> }, { value: 'table', label: 'Table', icon: <Rows3 size={14} /> }]} />
          <Link className="crm-btn primary" to="/employee-portal/sales/new"><Plus size={15} />New sale</Link>
        </div>
      </div>
      <div className="crm-metrics">
        <div className="crm-metric"><span>Open pipeline</span><strong>{formatMoney(pipeline)}</strong><small>{open.length} open {open.length === 1 ? 'deal' : 'deals'}</small></div>
        <div className="crm-metric" title="Each open deal's value multiplied by its stage likelihood: Draft 10%, Quote 30%, Negotiation 50%, Contract 75%, Signed 90%."><span>Weighted forecast</span><strong>{formatMoney(weighted)}</strong><small>Value × stage likelihood</small></div>
        <div className="crm-metric"><span>Won</span><strong>{formatMoney(wonValue)}</strong><small>{won.length} closed-won</small></div>
        <div className="crm-metric"><span>Win rate</span><strong>{won.length + lost.length ? `${Math.round((won.length / (won.length + lost.length)) * 100)}%` : '—'}</strong><small>{won.length + lost.length ? `${won.length} won of ${won.length + lost.length} closed` : 'No closed deals yet'}</small></div>
      </div>
      <div className="crm-toolbar">
        <label className="crm-search"><Search size={15} /><span className="sr-only">Search deals</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deals" /></label>
        {actor.isAdmin ? (
          <SelectFilter label="Assigned employee" value={owner} disabled={employees.loading} onChange={(value) => setParam('owner', value === 'all' ? null : value)}>
            <option value="all">Everyone</option>
            {employees.rows.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}
          </SelectFilter>
        ) : null}
        <button className="crm-btn ghost crm-right" type="button" onClick={exportCsv} disabled={!base.length}><Download size={14} />Export CSV</button>
      </div>

      {view === 'board' ? (
        !open.length ? <div className="crm-card"><Empty title={deals.rows.length ? 'No open deals match these filters' : 'No deals yet'}>{deals.rows.length ? 'Closed deals are listed in the table view.' : 'Convert a qualified lead or start a new sale to create the first deal.'}</Empty></div> : (
          <Kanban
            label="Deal pipeline board"
            items={open}
            columns={workingDealStages.map((stage) => ({ id: stage, label: dealStage(stage).label, emptyLabel: dealStage(stage).hint, summary: formatMoney(open.filter((deal) => deal.stage === stage).reduce((sum, deal) => sum + dealValue(deal), 0)) }))}
            zones={[{ id: 'closed_lost', label: <><XCircle size={17} /><span><strong>Mark lost</strong> — asks for a reason</span></> }]}
            getId={(deal) => String(deal.id)}
            getColumn={(deal) => String(deal.stage)}
            canMove={() => true}
            onMove={(deal, target) => void move(deal, target)}
            renderCard={card}
            pendingIds={pendingIds}
            attention={(deal) => signals.get(deal.id).overdueTasks > 0}
          />
        )
      ) : (
        <>
          <div className="crm-chips" role="group" aria-label="Deal status">
            {([['open', 'Open', open.length], ['won', 'Won', won.length], ['lost', 'Lost', lost.length], ['all', 'All', base.length]] as const).map(([value, label, count]) => <button key={value} className="crm-chip" type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{label} <b>{count}</b></button>)}
          </div>
          {!table.sorted.length ? <div className="crm-card"><Empty title="No deals in this view" /></div> : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr>
                  <SortHeader label="Deal" column="number" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Customer" column="customer" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Stage" column="stage" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Value" column="value" ariaSort={table.ariaSort} onSort={table.toggle} numeric />
                  {actor.isAdmin ? <SortHeader label="Sales rep" column="owner" ariaSort={table.ariaSort} onSort={table.toggle} /> : null}
                  <SortHeader label="Next step" column="next" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Updated" column="updated" ariaSort={table.ariaSort} onSort={table.toggle} />
                </tr></thead>
                <tbody>{table.sorted.map((deal) => {
                  const signal = signals.get(deal.id)
                  return (
                    <tr key={String(deal.id)}>
                      <td><div className="crm-cell-main"><Link to={`/employee-portal/deals/${String(deal.id)}`}>{String(deal.deal_number)}</Link><span>{String(deal.project_name ?? '')}</span></div></td>
                      <td>{String(contactOf(deal).display_name ?? '—')}</td>
                      <td><DealStageBadge stage={deal.stage} status={deal.status} /></td>
                      <td className="num">{formatMoney(dealValue(deal))}</td>
                      {actor.isAdmin ? <td><Owner row={deal} idField="sales_rep_id" /></td> : null}
                      <td className="crm-nowrap">{signal.nextTaskDue ? <span style={signal.overdueTasks ? { color: 'var(--crm-bad)' } : undefined}>{dueLabel(signal.nextTaskDue, now)}</span> : isOpenDeal(deal) ? <span style={{ color: 'var(--crm-progress)' }}>None booked</span> : '—'}</td>
                      <td className="crm-nowrap" title={formatDate(deal.updated_at)}>{relativeTime(deal.updated_at, now)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      {view === 'board' && (won.length || lost.length) ? <p className="crm-count">{won.length} won and {lost.length} lost {won.length + lost.length === 1 ? 'deal is' : 'deals are'} not on the board. <button className="crm-btn ghost small" type="button" onClick={() => { setScope('all'); setParam('view', 'table') }}>View all in table</button></p> : null}
      {losing ? <ReasonDialog title={`Close ${String(losing.deal_number)} as lost?`} body="The deal leaves the open pipeline. The reason is added to its timeline." label="Why was it lost?" confirmLabel="Mark lost" busy={busy} onClose={() => setLosing(null)} onConfirm={(reason) => void run(() => closeDealLost(actor, losing, reason), `${String(losing.deal_number)} closed as lost.`).then((ok) => { if (ok) setLosing(null) })} /> : null}
    </section>
  )
}
