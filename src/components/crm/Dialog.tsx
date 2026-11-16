import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  title: string
  eyebrow?: string
  variant?: 'modal' | 'drawer'
  onClose: () => void
  children: ReactNode
}

/**
 * Native <dialog> gives us the focus trap, Escape handling, inert background
 * and backdrop for free. It is mounted only while open.
 */
export function Dialog({ title, eyebrow, variant = 'modal', onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return (
    <dialog
      ref={ref}
      className={variant === 'drawer' ? 'crm-dialog drawer' : 'crm-dialog'}
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onMouseDown={(event) => { if (event.target === ref.current) onClose() }}
    >
      <div className="crm-dialog-inner">
        <header>
          <div>{eyebrow ? <span className="crm-eyebrow">{eyebrow}</span> : null}<h2>{title}</h2></div>
          <button className="crm-icon-btn" type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="crm-dialog-body">{children}</div>
      </div>
    </dialog>
  )
}

export function ConfirmDialog({ title, body, confirmLabel, busy, danger, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmLabel: string; busy?: boolean; danger?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{body}</p>
      <div className="crm-form-actions">
        <button className="crm-btn ghost" type="button" onClick={onClose}>Cancel</button>
        <button className={danger ? 'crm-btn danger' : 'crm-btn primary'} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Dialog>
  )
}

export function ReasonDialog({ title, body, label, confirmLabel, busy, onConfirm, onClose }: {
  title: string; body: string; label: string; confirmLabel: string; busy?: boolean; onConfirm: (reason: string) => void; onClose: () => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{body}</p>
      <form className="crm-form" onSubmit={(event) => { event.preventDefault(); onConfirm(input.current?.value ?? '') }}>
        <label className="crm-field"><span>{label}</span><textarea ref={input} rows={3} required minLength={2} maxLength={500} autoFocus /></label>
        <div className="crm-form-actions">
          <button className="crm-btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="crm-btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : confirmLabel}</button>
        </div>
      </form>
    </Dialog>
  )
}
