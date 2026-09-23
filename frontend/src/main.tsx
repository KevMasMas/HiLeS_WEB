import React, { StrictMode, Component } from 'react'
import type { ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 20, color: '#991b1b', background: '#fee2e2', fontFamily: 'monospace', height: '100vh', overflow: 'auto'}}>
          <h2>Fallo Crítico de React</h2>
          <pre style={{whiteSpace: 'pre-wrap'}}>{(this.state.error as Error).stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
