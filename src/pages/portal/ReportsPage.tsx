import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Filter, MessagesSquare, Radar, TrendingUp, UsersRound, XCircle } from 'lucide-react'
import { combineQueries, CRM_ROW_CAP, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { BarList, Empty, SelectFilter } from '../../components/crm/primitives'
import { timelineKind } from '../../lib/crm/activity'
import { csvFilename, downloadCsv } from '../../lib/crm/csv'
import { contactOf } from '../../lib/crm/links'
import { dealValue, formatDate, formatMoney, humanize, isOpenDeal, isOpenLead, leadFunnel, sourceBreakdown, weeklyCounts, type SourceRow } from '../../lib/crm/pipeline'
import { employeeSelect } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const ranges = [{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }, { value: 'all', label: 'All time' }]
const percent = (value: number | null) => value == null ? '—' : `${Math.round(value * 100)}%`
const touchLabels: Record<string, string> = { call: 'Calls', email: 'Emails', text: 'Texts', meeting: 'Meetings', note: 'Notes' }

interface RepRow { id: string; name: string; openLeads: number; converted: number; lost: number; touches: number; pipeline: number; won: number }

export default function ReportsPage() {
  const actor = useActor()
  const now = useNow()
  const [range, setRange] = useState('90')
  const leads = useCrmRows('leads', { select: 'id,status,source,created_at,converted_at,assigned_employee_id,lost_reason,updated_at,contacts(display_name)', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const deals = useCrmRows('deals', { select: 'id,stage,status,base_amount,delivery_amount,sales_rep_id,created_at,closed_at', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const activities = useCrmRows('activities', { select: 'id,activity_type,title,metadata,employee_id,created_at', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(leads, deals, activities)

  const since = range === 'all' ? 0 : now - Number(range) * 86_400_000
  const inRange = (value: unknown) => new Date(String(value)).getTime() >= since
  const periodLeads = useMemo(() => leads.rows.filter((lead) => new Date(String(lead.created_at)).getTime() >= since), [leads.rows, since])
  const touches = useMemo(() => activities.rows.filter((row) => new Date(String(row.created_at)).getTime() >= since && ['call', 'email', 'text', 'meeting', 'note'].includes(timelineKind(row))), [activities.rows, since])
  const funnel = useMemo(() => leadFunnel(periodLeads), [periodLeads])
  const sources = useMemo(() => sourceBreakdown(periodLeads), [periodLeads])
  const weeks = useMemo(() => weeklyCounts(leads.rows, 'created_at', 12, now), [leads.rows, now])

  const reps = useMemo<RepRow[]>(() => {
    if (!actor.isAdmin) return []
    return employees.rows.filter((person) => person.active).map((person) => {
      const id = String(person.id)
      const mine = periodLeads.filter((lead) => lead.assigned_employee_id === id)
      const myDeals = deals.rows.filter((deal) => deal.sales_rep_id === id)
      return {
        id, name: String(person.display_name),
        openLeads: leads.rows.filter((lead) => lead.assigned_employee_id === id && isOpenLead(lead)).length,
        converted: mine.filter((lead) => lead.status === 'converted').length,
        lost: mine.filter((lead) => lead.status === 'lost').length,
        touches: touches.filter((row) => row.employee_id === id).length,
        pipeline: myDeals.filter(isOpenDeal).reduce((sum, deal) => sum + dealValue(deal), 0),
        won: myDeals.filter((deal) => deal.status === 'won' && (!deal.closed_at || new Date(String(deal.closed_at)).getTime() >= since)).reduce((sum, deal) => sum + dealValue(deal), 0),
      }
    }).sort((a, b) => b.touches - a.touches || b.openLeads - a.openLeads)
  }, [actor.isAdmin, deals.rows, employees.rows, leads.rows, periodLeads, since, touches])

  if (page.loading) return <PortalLoading label="Building reports" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const converted = periodLeads.filter((lead) => lead.status === 'converted')
  const lost = periodLeads.filter((lead) => lead.status === 'lost')
  const decided = converted.length + lost.length
  const daysToConvert = converted.map((lead) => (new Date(String(lead.converted_at)).getTime() - new Date(String(lead.created_at)).getTime()) / 86_400_000).filter((value) => Number.isFinite(value) && value >= 0)
  const averageDays = daysToConvert.length ? daysToConvert.reduce((sum, value) => sum + value, 0) / daysToConvert.length : null
  const wonDeals = deals.rows.filter((deal) => deal.status === 'won' && deal.closed_at && inRange(deal.closed_at))
  const touchMix = Object.entries(touchLabels).map(([kind, label]) => ({ label, value: touches.filter((row) => timelineKind(row) === kind).length }))
  const maxWeek = Math.max(1, ...weeks.map((week) => week.count))
  const rangeLabel = ranges.find((item) => item.value === range)?.label.toLowerCase() ?? ''
  const truncated = leads.rows.length === CRM_ROW_CAP || activities.rows.length === CRM_ROW_CAP || deals.rows.length === CRM_ROW_CAP

  return (
    <section className="crm-page" aria-labelledby="reports-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">CRM / PERFORMANCE</span><h2 id="reports-heading">Reports</h2><p>{actor.isAdmin ? 'Company-wide results.' : 'Results for the records assigned to you.'} Figures are calculated from the live CRM each time this page loads.</p></div>
        <div className="crm-header-actions"><SelectFilter label="Period" value={range} onChange={setRange}>{ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectFilter></div>
      </div>
      {truncated ? <div className="crm-banner">This report reads the newest 1,000 leads, deals, and timeline entries. Older history is not included in these totals.</div> : null}

      <div className="crm-metrics">
        <div className="crm-metric"><span>New leads</span><strong>{periodLeads.length}</strong><small>Created {rangeLabel}</small></div>
        <div className="crm-metric" title="Converted ÷ (converted + lost), for leads created in this period. Leads still open are not counted."><span>Lead conversion</span><strong>{percent(decided ? converted.length / decided : null)}</strong><small>{decided ? `${converted.length} converted of ${decided} decided` : 'No leads decided yet'}</small></div>
        <div className="crm-metric"><span>Average time to convert</span><strong>{averageDays == null ? '—' : `${averageDays < 10 ? averageDays.toFixed(1) : Math.round(averageDays)}d`}</strong><small>{daysToConvert.length ? `Across ${daysToConvert.length} converted lead${daysToConvert.length === 1 ? '' : 's'}` : 'No conversions in this period'}</small></div>
        <div className="crm-metric"><span>Deals won</span><strong>{formatMoney(wonDeals.reduce((sum, deal) => sum + dealValue(deal), 0))}</strong><small>{wonDeals.length} closed {rangeLabel}</small></div>
      </div>

      <div className="crm-two">
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">INTAKE</span><h3>New leads per week</h3></div><TrendingUp size={18} /></div>
          <div className="crm-columns" role="img" aria-label={`New leads per week for the last 12 weeks: ${weeks.map((week) => `${week.label}, ${week.count}`).join('; ')}`}>
            {weeks.map((week) => (
              <div key={week.start} title={`Week of ${week.label}: ${week.count} new lead${week.count === 1 ? '' : 's'}`}>
                {week.count ? <span className="tip" style={{ bottom: `${(week.count / maxWeek) * 100}%` }}>{week.count}</span> : null}
                <span className="col" style={{ height: `${(week.count / maxWeek) * 100}%`, visibility: week.count ? 'visible' : 'hidden' }} />
              </div>
            ))}
          </div>
          <div className="crm-columns-axis" aria-hidden="true">{weeks.map((week, index) => <span key={week.start}>{index % 2 === 0 ? week.label : ''}</span>)}</div>
          <p className="crm-card-foot">Last 12 weeks, by the Monday each week starts. Not affected by the period filter.</p>
        </article>
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">FUNNEL</span><h3>How far leads get</h3></div><Filter size={18} /></div>
          {periodLeads.length ? <BarList data={funnel.map((step) => ({ label: step.label, value: step.reached, note: percent(step.reached / periodLeads.length) }))} /> : <Empty title="No leads in this period" />}
          <p className="crm-card-foot">Each bar counts leads at or beyond that stage. Lost and archived leads count only toward New, because the stage they were lost from is not recorded.</p>
        </article>
      </div>

      <div className="crm-two">
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">DEMAND</span><h3>Results by lead source</h3></div><Radar size={18} /></div>
          {sources.length ? (
            <div className="crm-table-wrap" style={{ border: 0, background: 'transparent' }}>
              <table className="crm-table" style={{ minWidth: 420 }}>
                <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Open</th><th className="num">Converted</th><th className="num">Lost</th><th className="num">Conversion</th></tr></thead>
                <tbody>{sources.map((row) => <tr key={row.source}><td>{humanize(row.source)}</td><td className="num">{row.total}</td><td className="num">{row.open}</td><td className="num">{row.converted}</td><td className="num">{row.lost}</td><td className="num">{percent(row.conversion)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <Empty title="No leads in this period" />}
          <p className="crm-card-foot"><button className="crm-btn ghost small" type="button" disabled={!sources.length} onClick={() => downloadCsv<SourceRow>(csvFilename('lead-sources'), sources, [
            { header: 'Source', value: (row) => humanize(row.source) }, { header: 'Leads', value: (row) => row.total }, { header: 'Open', value: (row) => row.open },
            { header: 'Converted', value: (row) => row.converted }, { header: 'Lost', value: (row) => row.lost }, { header: 'Conversion', value: (row) => row.conversion == null ? '' : Math.round(row.conversion * 100) / 100 },
          ])}><Download size={13} />Export CSV</button></p>
        </article>
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">EFFORT</span><h3>Logged activity</h3></div><MessagesSquare size={18} /></div>
          <BarList data={touchMix} />
          <p className="crm-card-foot">{touches.length} entries logged {rangeLabel}. Only activity recorded in the CRM is counted.</p>
        </article>
      </div>

      {actor.isAdmin ? (
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">ADMIN / TEAM</span><h3>Results by person</h3></div><UsersRound size={18} /></div>
          <div className="crm-table-wrap" style={{ border: 0, background: 'transparent' }}>
            <table className="crm-table" style={{ minWidth: 640 }}>
              <thead><tr><th>Employee</th><th className="num">Open leads</th><th className="num">Converted</th><th className="num">Lost</th><th className="num">Logged activity</th><th className="num">Open pipeline</th><th className="num">Won</th></tr></thead>
              <tbody>{reps.map((rep) => <tr key={rep.id}><td><Link to={`/employee-portal/admin/employees?employee=${rep.id}`} style={{ fontWeight: 700 }}>{rep.name}</Link></td><td className="num">{rep.openLeads}</td><td className="num">{rep.converted}</td><td className="num">{rep.lost}</td><td className="num">{rep.touches}</td><td className="num">{formatMoney(rep.pipeline)}</td><td className="num">{formatMoney(rep.won)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="crm-card-foot">Open leads and open pipeline are current. Converted, lost, logged activity, and won cover {rangeLabel}. <button className="crm-btn ghost small" type="button" disabled={!reps.length} onClick={() => downloadCsv<RepRow>(csvFilename('team-results'), reps, [
            { header: 'Employee', value: (row) => row.name }, { header: 'Open leads', value: (row) => row.openLeads }, { header: 'Converted', value: (row) => row.converted }, { header: 'Lost', value: (row) => row.lost },
            { header: 'Logged activity', value: (row) => row.touches }, { header: 'Open pipeline', value: (row) => row.pipeline }, { header: 'Won', value: (row) => row.won },
          ])}><Download size={13} />Export CSV</button></p>
        </article>
      ) : null}

      <article className="crm-card">
        <div className="crm-card-head"><div><span className="crm-eyebrow">LOSSES</span><h3>Why leads were lost</h3></div><XCircle size={18} /></div>
        {lost.length ? <ul className="crm-linklist">{lost.slice(0, 12).map((lead: JsonRecord) => <li key={String(lead.id)}><Link className="crm-card-link" to={`/employee-portal/leads/${String(lead.id)}`}><span><strong>{String(contactOf(lead).display_name ?? 'Lead')}</strong><small>{String(lead.lost_reason ?? 'No reason recorded')}</small></span><span className="crm-dim" style={{ fontSize: 11.5 }}>{humanize(lead.source)} · {formatDate(lead.updated_at)}</span></Link></li>)}</ul> : <Empty title="No lost leads in this period" />}
      </article>
    </section>
  )
}
