import { Component, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

export class WorkspaceErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true } }
  componentDidCatch(error: Error): void { console.error('Workspace display failed:', error) }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return <section className="companion-empty" role="alert"><CircleAlert /><div><h2>Workspace could not be displayed</h2><p>Your Google Drive file has not been changed. Return to the workspace and try another download or import.</p></div><button className="secondary-button" onClick={this.props.onReset}>Back to workspace</button></section>
  }
}
