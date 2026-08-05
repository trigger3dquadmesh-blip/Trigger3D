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
          Could not render this GLB: {this.state.error.message}
        </div>
      )
    }

    return this.props.children
  }
}
