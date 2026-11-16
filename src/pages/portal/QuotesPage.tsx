import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { useSort } from '../../hooks/useSort'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { SortHeader } from '../../components/crm/SortHeader'
import { Empty, Owner, SelectFilter, StatusBadge } from '../../components/crm/primitives'
import { csvFilename, downloadCsv } from '../../lib/crm/csv'
import { contactOf } from '../../lib/crm/links'
import { formatDate, formatMoney, humanize, matchesSearch, relativeTime, toNumber } from '../../lib/crm/pipeline'
import { employeeSelect, related } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const quoteSelect = '*,contacts(display_name,email),deals(id,deal_number,project_name),owner:employees!quotes_employee_id_fkey(id,display_name,rep_code)'
const statuses = ['draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled']
type SortKey = 'number' | 'customer' | 'status' | 'total' | 'owner' | 'updated'

export default function QuotesPage() {
  const actor = useActor()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const owner = actor.isAdmin ? params.get('owner') ?? 'all' : 'all'
  const quotes = useCrmRows('quotes', { select: quoteSelect, orderBy: 'updated_at', limit: 1000 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(quotes)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const query = useDeferredValue(search)

  const scoped = useMemo(() => quotes.rows.filter((quote) => {
    if (owner !== 'all' && quote.employee_id !== owner) return false
    return matchesSearch([quote.quote_number, contactOf(quote).display_name, contactOf(quote).email, related(quote, 'deals')?.deal_number, related(quote, 'deals')?.project_name], query)
  }), [owner, query, quotes.rows])
  const visible = useMemo(() => scoped.filter((quote) => status === 'all' || quote.status === status), [scoped, status])
  const accessors = useMemo(() => ({
    number: (quote: JsonRecord) => String(quote.quote_number ?? ''),
    customer: (quote: JsonRecord) => String(contactOf(quote).display_name ?? ''),
    status: (quote: JsonRecord) => statuses.indexOf(String(quote.status)),
    total: (quote: JsonRecord) => -toNumber(quote.total),
    owner: (quote: JsonRecord) => String((quote.owner as JsonRecord | null)?.display_name ?? ''),
    updated: (quote: JsonRecord) => String(quote.updated_at ?? ''),
  }), [])
  const table = useSort<JsonRecord, SortKey>(visible, accessors, { key: 'updated', direction: 'desc' })

  if (page.loading) return <PortalLoading label="Loading quotes" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const outstanding = scoped.filter((quote) => quote.status === 'sent')
  return (
    <section className="crm-page" aria-labelledby="quotes-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">SALES / QUOTES</span><h2 id="quotes-heading">Quote records</h2><p>Itemized pricing for each deal. Start a quote from a deal, edit the lines, then print or save it as a PDF to send.</p></div>
        <div className="crm-header-actions"><Link className="crm-btn" to="/employee-portal/deals">Start from a deal</Link></div>
      </div>
      <div className="crm-toolbar">
        <label className="crm-search"><Search size={15} /><span className="sr-only">Search quotes</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotes" /></label>
        {actor.isAdmin ? (
          <SelectFilter label="Assigned employee" value={owner} disabled={employees.loading} onChange={(value) => setParams(value === 'all' ? {} : { owner: value }, { replace: true })}>
            <option value="all">Everyone</option>
            {employees.rows.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}
          </SelectFilter>
        ) : null}
        <button className="crm-btn ghost crm-right" type="button" disabled={!table.sorted.length} onClick={() => downloadCsv(csvFilename('quotes'), table.sorted, [
          { header: 'Quote', value: (quote) => quote.quote_number }, { header: 'Customer', value: (quote) => contactOf(quote).display_name },
          { header: 'Deal', value: (quote) => related(quote, 'deals')?.deal_number }, { header: 'Status', value: (quote) => humanize(quote.status) },
          { header: 'Subtotal', value: (quote) => quote.subtotal }, { header: 'Tax', value: (quote) => quote.tax }, { header: 'Delivery', value: (quote) => quote.delivery_amount },
          { header: 'Total', value: (quote) => quote.total }, { header: 'Sent', value: (quote) => formatDate(quote.sent_at) }, { header: 'Updated', value: (quote) => formatDate(quote.updated_at) },
        ])}><Download size={14} />Export CSV</button>
      </div>
      <div className="crm-toolbar">
        <div className="crm-chips" role="group" aria-label="Quote status">
          <button className="crm-chip" type="button" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>All <b>{scoped.length}</b></button>
          {statuses.map((item) => <button key={item} className="crm-chip" type="button" aria-pressed={status === item} onClick={() => setStatus(item)}>{humanize(item)} <b>{scoped.filter((quote) => quote.status === item).length}</b></button>)}
        </div>
        <span className="crm-count crm-right">{outstanding.length} awaiting a customer answer · {formatMoney(outstanding.reduce((sum, quote) => sum + toNumber(quote.total), 0))}</span>
      </div>
      {!table.sorted.length ? <div className="crm-card"><Empty title={quotes.rows.length ? 'No quotes match these filters' : 'No quotes yet'}>{quotes.rows.length ? 'Choose another status or clear the search.' : 'Open a deal and choose New quote to draft the first one.'}</Empty></div> : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr>
              <SortHeader label="Quote" column="number" ariaSort={table.ariaSort} onSort={table.toggle} />
              <SortHeader label="Customer" column="customer" ariaSort={table.ariaSort} onSort={table.toggle} />
              <SortHeader label="Status" column="status" ariaSort={table.ariaSort} onSort={table.toggle} />
              <SortHeader label="Total" column="total" ariaSort={table.ariaSort} onSort={table.toggle} numeric />
              {actor.isAdmin ? <SortHeader label="Assigned employee" column="owner" ariaSort={table.ariaSort} onSort={table.toggle} /> : null}
              <SortHeader label="Updated" column="updated" ariaSort={table.ariaSort} onSort={table.toggle} />
            </tr></thead>
            <tbody>{table.sorted.map((quote) => {
              const deal = related(quote, 'deals')
              return (
                <tr key={String(quote.id)}>
                  <td><div className="crm-cell-main"><Link to={`/employee-portal/quotes/${String(quote.id)}`}>{String(quote.quote_number)}</Link><span>{deal ? `${String(deal.deal_number)} · ${String(deal.project_name ?? '')}` : 'No deal linked'}</span></div></td>
                  <td>{String(contactOf(quote).display_name ?? '—')}</td>
                  <td><StatusBadge value={quote.status} /></td>
                  <td className="num">{formatMoney(quote.total)}</td>
                  {actor.isAdmin ? <td><Owner row={quote} idField="employee_id" /></td> : null}
                  <td className="crm-nowrap" title={formatDate(quote.updated_at)}>{relativeTime(quote.updated_at, now)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
