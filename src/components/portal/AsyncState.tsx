import { AlertTriangle, Clock3, Inbox, LoaderCircle, RefreshCw, ShieldX } from 'lucide-react'

export function PortalLoading({ label = 'Loading workspace data' }: { label?: string }) {
  return <div className="portal-state" role="status"><LoaderCircle className="spin" /><strong>{label}</strong><span>Securely requesting your assigned records.</span></div>
}

export function PortalEmpty({ title, copy }: { title: string; copy: string }) {
  return <div className="portal-state"><Inbox /><strong>{title}</strong><span>{copy}</span></div>
}

export function PortalError({ message, retry }: { message: string; retry?: () => void }) {
  const denied = /permission|policy|authorized|jwt/i.test(message)
  return <div className="portal-state error" role="alert">{denied ? <ShieldX /> : <AlertTriangle />}<strong>{denied ? 'Permission denied' : 'Data unavailable'}</strong><span>{message}</span>{retry ? <button className="portal-secondary-button" type="button" onClick={retry}><RefreshCw size={14} /> Retry</button> : null}</div>
}

export function ConfigurationState({ service, copy }: { service: string; copy: string }) {
  return <div className="configuration-state"><AlertTriangle size={17} /><div><strong>{service} is not configured</strong><span>{copy}</span></div></div>
}

export function ComingSoonBanner({ title, copy }: { title: string; copy: string }) {
  return <div className="coming-soon-banner" role="status"><span className="coming-soon-icon"><Clock3 size={19} /></span><div><span>ROADMAP / COMING SOON</span><strong>{title}</strong><p>{copy}</p></div><span className="coming-soon-chip">Deferred</span></div>
}
