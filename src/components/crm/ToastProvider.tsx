import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { ToastContext } from './toast-context'

interface Toast { id: number; kind: 'success' | 'error'; message: string }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++nextId.current
    setToasts((current) => [...current.slice(-3), { id, kind, message }])
    // Errors stay longer: they usually need to be read, not just noticed.
    window.setTimeout(() => dismiss(id), kind === 'error' ? 9000 : 4000)
  }, [dismiss])
  const api = useMemo(() => ({ success: (message: string) => push('success', message), error: (message: string) => push('error', message) }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="crm-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`crm-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            {toast.kind === 'error' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
