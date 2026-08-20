import { MoonStar, Sun } from 'lucide-react'
import { useTheme } from '../theme/useTheme'

export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  const nextTheme = isLight ? 'dark' : 'light'

  return (
    <button
      className={`theme-toggle${compact ? ' theme-toggle-compact' : ''}${className ? ` ${className}` : ''}`}
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={isLight}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-slider" />
        <span className="theme-toggle-option theme-toggle-light"><Sun size={14} strokeWidth={2.2} /><b>Light</b></span>
        <span className="theme-toggle-option theme-toggle-dark"><MoonStar size={14} strokeWidth={2.2} /><b>Dark</b></span>
      </span>
    </button>
  )
}
