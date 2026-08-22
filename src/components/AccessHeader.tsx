import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Logo } from './ui'
import { ThemeToggle } from './ThemeToggle'

type AccessHeaderProps = {
  onNavigate: (path: string) => void
  backLabel?: string
  backPath?: string
  compact?: boolean
}

export function AccessHeader({
  onNavigate,
  backLabel = 'Back to site',
  backPath = '/',
  compact = false,
}: AccessHeaderProps) {
  return (
    <header className={compact ? 'access-header access-header-compact' : 'access-header'}>
      <Logo onNavigate={onNavigate} />
      <div className="access-header-actions">
        <ThemeToggle />
        <span className="demo-chip"><ShieldCheck size={14} aria-hidden="true" /> Secure access</span>
        <a
          className="access-back"
          href={backPath}
          onClick={(event) => {
            event.preventDefault()
            onNavigate(backPath)
          }}
        >
          <ArrowLeft size={15} aria-hidden="true" /> {backLabel}
        </a>
      </div>
    </header>
  )
}
