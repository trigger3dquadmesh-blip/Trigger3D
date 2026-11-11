import { Component, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AdminIcon from '../../admin/AdminIcon.jsx'

class ViewerRenderBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, details) {
    console.error('The student firearm viewer could not be rendered.', error, details)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="page status-page student-viewer-status-page">
        <section className="card student-viewer-error-card" role="alert">
          <span className="student-viewer-status-icon"><AdminIcon name="alertTriangle" /></span>
          <div className="student-viewer-error-copy">
            <p className="eyebrow">Viewer recovery</p>
            <h1>The firearm viewer stopped loading</h1>
            <p>Trigger3D encountered a display problem while opening this model. Try the viewer again without leaving your signed-in session.</p>
          </div>
          <footer>
            <button className="student-viewer-retry-button" onClick={this.props.onRetry} type="button">
              <AdminIcon name="reset" />Try viewer again
            </button>
            <Link className="student-viewer-return-button" to="/student">
              <AdminIcon name="arrowLeft" />Return to dashboard
            </Link>
          </footer>
        </section>
      </main>
    )
  }
}

export default function StudentViewerErrorBoundary({ children }) {
  const location = useLocation()
  const [recoveryKey, setRecoveryKey] = useState(0)
  const boundaryKey = `${location.pathname}:${location.search}:${recoveryKey}`

  return (
    <ViewerRenderBoundary
      key={boundaryKey}
      onRetry={() => setRecoveryKey((value) => value + 1)}
    >
      {children}
    </ViewerRenderBoundary>
  )
}
