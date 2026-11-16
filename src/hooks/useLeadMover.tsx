import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JsonRecord } from '../lib/database.types'
import { convertLead, setLeadStatus } from '../lib/crm/api'
import { leadStage, openLeadStatuses, type LeadStatus } from '../lib/crm/pipeline'
import { contactOf } from '../lib/crm/links'
import { ConfirmDialog, ReasonDialog } from '../components/crm/Dialog'
import { useAction, useActor } from './useCrm'

/**
 * One place for every way a lead changes stage — board drag, card menu, table
 * row, bulk bar, and the record page. Working-stage moves save immediately;
 * closing moves (lost, archive, convert) ask first.
 */
export function useLeadMover() {
  const actor = useActor()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const [prompt, setPrompt] = useState<{ lead: JsonRecord; target: LeadStatus } | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const move = useCallback(async (lead: JsonRecord, target: LeadStatus, reason = '') => {
    const id = String(lead.id)
    setPendingIds((current) => new Set(current).add(id))
    const ok = await run(() => setLeadStatus(actor, lead, target, reason), `${String(contactOf(lead).display_name ?? 'Lead')} moved to ${leadStage(target).label}.`)
    setPendingIds((current) => { const next = new Set(current); next.delete(id); return next })
    return ok
  }, [actor, run])

  const request = useCallback((lead: JsonRecord, target: LeadStatus) => {
    if (target === lead.status) return
    if (openLeadStatuses.includes(target)) void move(lead, target)
    else setPrompt({ lead, target })
  }, [move])

  let dialogs: ReactNode = null
  if (prompt) {
    const name = String(contactOf(prompt.lead).display_name ?? 'this lead')
    const close = () => setPrompt(null)
    if (prompt.target === 'lost') {
      dialogs = <ReasonDialog title={`Mark ${name} lost?`} body="The lead leaves the working pipeline. The reason is saved on the record and shows in reporting." label="Why was it lost?" confirmLabel="Mark lost" busy={busy} onClose={close} onConfirm={(reason) => void move(prompt.lead, 'lost', reason).then((ok) => { if (ok) close() })} />
    } else if (prompt.target === 'converted') {
      dialogs = <ConfirmDialog title={`Convert ${name} to a deal?`} body="A draft deal is created for this customer and the lead is locked as converted. Open follow-ups stay with the owner." confirmLabel="Convert to deal" busy={busy} onClose={close} onConfirm={() => void run(async () => {
        const result = await convertLead(actor, prompt.lead)
        close()
        navigate(`/employee-portal/deals/${result.dealId}`)
      }, 'Lead converted. Draft deal created.')} />
    } else {
      dialogs = <ConfirmDialog title={`Archive ${name}?`} body="Archived leads are hidden from the working pipeline but stay in the customer history. An administrator can restore them." confirmLabel="Archive lead" busy={busy} onClose={close} onConfirm={() => void move(prompt.lead, 'archived').then((ok) => { if (ok) close() })} />
    }
  }

  return { request, move, dialogs, pendingIds, busy }
}
