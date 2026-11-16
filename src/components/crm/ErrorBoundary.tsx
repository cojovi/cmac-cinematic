import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { failed: boolean }

/** Keeps a rendering fault on one screen from blanking the whole portal. Navigation stays usable. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal screen failed to render', error.message, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="portal-state error" role="alert">
        <AlertTriangle />
        <strong>This screen could not be displayed</strong>
        <span>Nothing was changed. Reload to try again, or use the menu to open another area.</span>
        <button className="portal-secondary-button" type="button" onClick={() => window.location.reload()}><RefreshCw size={14} /> Reload</button>
      </div>
    )
  }
}
