import { Component } from 'react'
import AdminIcon from '../../admin/AdminIcon.jsx'

export default class StudentViewerErrorBoundary extends Component {
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
            <p>Trigger3D encountered a display problem while opening this model. Reload the viewer to try again.</p>
          </div>
          <footer>
            <button className="student-viewer-retry-button" onClick={() => window.location.reload()} type="button">
              <AdminIcon name="reset" />Reload viewer
            </button>
            <a className="student-viewer-return-button" href="/student">
              <AdminIcon name="arrowLeft" />Return to dashboard
            </a>
          </footer>
        </section>
      </main>
    )
  }
}
