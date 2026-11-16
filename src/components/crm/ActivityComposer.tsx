import { useState, type FormEvent } from 'react'
import { Mail, MessageSquare, Phone, Save, StickyNote, Users, type LucideIcon } from 'lucide-react'
import { touchDef, touchKinds, type TouchKind } from '../../lib/crm/activity'
import { createTask, logTouch } from '../../lib/crm/api'
import { duePresets, presetDue, type DuePreset } from '../../lib/crm/pipeline'
import { useAction, useActor } from '../../hooks/useCrm'

const icons: Record<TouchKind, LucideIcon> = { note: StickyNote, call: Phone, email: Mail, text: MessageSquare, meeting: Users }

export interface RecordTarget { contactId: string | null; leadId?: string | null; dealId?: string | null; ownerId?: string | null }

/**
 * Log what just happened and — in the same save — book the next step.
 * Pairing the two is what keeps a pipeline from going quiet.
 */
export function ActivityComposer({ target, subject }: { target: RecordTarget; subject: string }) {
  const actor = useActor()
  const { run, busy } = useAction()
  const [kind, setKind] = useState<TouchKind>('call')
  const [outcome, setOutcome] = useState(touchDef('call').outcomes[0] ?? '')
  const [body, setBody] = useState('')
  const [followUp, setFollowUp] = useState<DuePreset | ''>('')
  const def = touchDef(kind)

  function choose(next: TouchKind) {
    setKind(next)
    setOutcome(touchDef(next).outcomes[0] ?? '')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const saved = await run(async () => {
      await logTouch(actor, { kind, outcome, body, contactId: target.contactId, leadId: target.leadId, dealId: target.dealId })
      if (followUp) {
        await createTask(actor, {
          title: `Follow up with ${subject}`, dueAt: presetDue(followUp, Date.now()), priority: 'normal',
          // A rep's follow-up is theirs; an admin logging on someone else's record books it for the owner.
          employeeId: actor.isAdmin && target.ownerId ? target.ownerId : actor.id,
          contactId: target.contactId, leadId: target.leadId, dealId: target.dealId,
        })
      }
    }, followUp ? `${def.label} saved and follow-up scheduled.` : `${def.label} saved to the timeline.`)
    if (saved) { setBody(''); setFollowUp('') }
  }

  return (
    <form className="crm-form" onSubmit={submit}>
      <div className="crm-composer-tabs" role="tablist" aria-label="Entry type">
        {touchKinds.map((item) => {
          const Icon = icons[item.value]
          return <button key={item.value} type="button" role="tab" aria-selected={kind === item.value} onClick={() => choose(item.value)}><Icon size={14} />{item.label}</button>
        })}
      </div>
      {def.outcomes.length ? (
        <label className="crm-field"><span>Outcome</span>
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>{def.outcomes.map((item) => <option key={item}>{item}</option>)}</select>
        </label>
      ) : null}
      <label className="crm-field"><span>{kind === 'note' ? 'Note' : 'Details'}</span>
        <textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder={def.placeholder} required={kind === 'note'} maxLength={4000} />
      </label>
      <div className="crm-composer-row">
        <label className="crm-select"><span>Next step</span>
          <select value={followUp} onChange={(event) => setFollowUp(event.target.value as DuePreset | '')} aria-label="Schedule a follow-up">
            <option value="">No follow-up</option>
            {duePresets.map((preset) => <option key={preset.value} value={preset.value}>Follow up: {preset.label.toLowerCase()}</option>)}
          </select>
        </label>
        <button className="crm-btn primary crm-right" type="submit" disabled={busy}><Save size={14} />{busy ? 'Saving…' : `Save ${def.label.toLowerCase()}`}</button>
      </div>
    </form>
  )
}
