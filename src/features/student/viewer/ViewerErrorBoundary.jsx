import { Component } from 'react'

export default class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      // Reset after a new signed URL or model is supplied.
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="viewer-fallback viewer-error" role="alert">
          <strong>The 3D viewer stopped loading.</strong>
          <span>{this.state.error.message || 'The model could not be displayed.'}</span>
          <button onClick={this.props.onRetry} type="button">Try model again</button>
        </div>
      )
    }

    return this.props.children
  }
}
