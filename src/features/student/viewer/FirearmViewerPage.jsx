import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase.js'
import FirearmCanvas from './FirearmCanvas.jsx'
import { getAssessmentLockKey } from '../assessment/assessment-lock.js'

export default function FirearmViewerPage() {
  const { firearmId } = useParams()
  const [firearm, setFirearm] = useState(null)
  const [components, setComponents] = useState([])
  const [modelUrl, setModelUrl] = useState('')
  const [selectedName, setSelectedName] = useState(null)
  const [exploded, setExploded] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [componentsOpen, setComponentsOpen] = useState(true)
  const [componentQuery, setComponentQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    let active = true

    async function loadViewer() {
      const [firearmResult, statusResult] = await Promise.all([
        supabase
          .from('firearms')
          .select('id, identifier, name, caliber, description, glb_storage_path, status')
          .eq('id', firearmId)
          .single(),
        supabase.rpc('get_assessment_status', { target_firearm_id: firearmId }),
      ])

      if (!active) return
      if (firearmResult.error || statusResult.error) {
        setError(firearmResult.error?.message || statusResult.error.message)
        setLoading(false)
        return
      }

      const firearmData = firearmResult.data
      setFirearm(firearmData)
      if (statusResult.data.attempt_status === 'in_progress') {
        setLocked(true)
        setLoading(false)
        return
      }

      const { data: componentData, error: componentError } = await supabase
        .from('firearm_components')
        .select(`
          id,
          mesh_name,
          category,
          purpose,
          description,
          display_order,
          explode_x,
          explode_y,
          explode_z,
          explode_order,
          assembly_group
        `)
        .eq('firearm_id', firearmId)
        .order('display_order')

      if (!active) return
      if (componentError) {
        setError(componentError.message)
        setLoading(false)
        return
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('firearm-models')
        .createSignedUrl(firearmData.glb_storage_path, 3600)

      if (!active) return
      if (signedUrlError) {
        setError(signedUrlError.message)
        setLoading(false)
        return
      }

      setComponents(componentData)
      setModelUrl(signedUrlData.signedUrl)
      setLoading(false)
    }

    void loadViewer()
    return () => { active = false }
  }, [firearmId])

  useEffect(() => {
    const lockKey = getAssessmentLockKey(firearmId)
    function handleStorage(event) {
      if (event.key === lockKey && event.newValue) setLocked(true)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [firearmId])

  const selectedComponent = useMemo(
    () => components.find((component) => component.mesh_name === selectedName) ?? null,
    [components, selectedName],
  )
  const filteredComponents = useMemo(() => {
    const normalizedQuery = componentQuery.trim().toLowerCase()
    return components.filter((component) => (
      (categoryFilter === 'all' || component.category === categoryFilter)
      && (!normalizedQuery || component.mesh_name.replaceAll('_', ' ').toLowerCase().includes(normalizedQuery))
    ))
  }, [categoryFilter, componentQuery, components])

  if (loading) return <main className="page status-page">Loading 3D viewer...</main>

  if (error) {
    return (
      <main className="page">
        <section className="card">
          <p className="eyebrow">Viewer unavailable</p>
          <h1>Unable to load model</h1>
          <div className="alert alert-error" role="alert">{error}</div>
          <Link className="text-link" to="/student">Back to dashboard</Link>
        </section>
      </main>
    )
  }

  if (locked) {
    return (
      <main className="page">
        <section className="card">
          <p className="eyebrow">Assessment in progress</p>
          <h1>Model viewing is locked</h1>
          <p>
            The {firearm?.name || 'firearm'} model cannot be inspected while its assessment
            is in progress.
          </p>
          <Link className="assessment-button" to={`/student/models/${firearmId}/assessment`}>
            Resume assessment
          </Link>
          <Link className="text-link" to="/student">Back to dashboard</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="model-viewer-page">
      <header className="viewer-header">
        <div className="viewer-title-group">
          <Link to="/student">← Student dashboard</Link>
          <div>
            <h1>{firearm.name}</h1>
            <span>{firearm.caliber} · {components.length} components</span>
          </div>
        </div>
        <div className="viewer-controls">
          <button aria-expanded={componentsOpen} type="button" onClick={() => setComponentsOpen((current) => !current)}>
            Components
          </button>
          <Link className="assessment-button viewer-assessment-button" to={`/student/models/${firearmId}/assessment`}>Open assessment</Link>
        </div>
      </header>

      <section className="viewer-layout" data-components-open={componentsOpen} data-details-open={Boolean(selectedComponent)}>
        {componentsOpen && <aside className="viewer-sidebar component-browser">
          <div className="viewer-panel-heading">
            <div><h2>Components</h2><p>Select a name or click the model.</p></div>
            <button aria-label="Close components panel" className="viewer-panel-close" onClick={() => setComponentsOpen(false)} type="button">×</button>
          </div>
          <label className="component-search">
            <span>Search components</span>
            <input value={componentQuery} onChange={(event) => setComponentQuery(event.target.value)} placeholder="Search by name" />
          </label>
          <div className="component-filters" aria-label="Filter components">
            {['all', 'external', 'internal'].map((category) => <button aria-pressed={categoryFilter === category} className={categoryFilter === category ? 'selected' : ''} key={category} onClick={() => setCategoryFilter(category)} type="button">{category}</button>)}
          </div>
          {['external', 'internal'].map((category) => (
            <div className="component-group" key={category}>
              <h3>{category}</h3>
              {filteredComponents
                .filter((component) => component.category === category)
                .map((component) => (
                  <button
                    type="button"
                    className={component.mesh_name === selectedName ? 'selected' : ''}
                    key={component.id}
                    onClick={() => setSelectedName(component.mesh_name)}
                  >
                    {component.mesh_name.replaceAll('_', ' ')}
                  </button>
                ))}
            </div>
          ))}
          {filteredComponents.length === 0 && <p className="component-empty">No matching components.</p>}
        </aside>}

        <div className="viewer-stage">
          <FirearmCanvas modelUrl={modelUrl} components={components} selectedName={selectedName} exploded={exploded} resetKey={resetKey} onSelect={setSelectedName} />
          <div className="viewer-canvas-toolbar" aria-label="3D viewer controls">
            <button aria-pressed={exploded} type="button" onClick={() => setExploded((current) => !current)}>{exploded ? 'Reassemble' : 'Exploded view'}</button>
            <button type="button" onClick={() => setResetKey((current) => current + 1)}>Reset camera</button>
          </div>
          <p className="viewer-canvas-hint">Drag to rotate · Scroll to zoom · Select a component for details</p>
        </div>

        {selectedComponent && <aside className="viewer-sidebar information-panel">
          <div className="viewer-panel-heading">
            <div><p className="eyebrow">Component details</p><h2>{selectedComponent.mesh_name.replaceAll('_', ' ')}</h2></div>
            <button aria-label="Close component details" className="viewer-panel-close" onClick={() => setSelectedName(null)} type="button">×</button>
          </div>
          <div className="component-information">
            <span className={`status-badge ${selectedComponent.category === 'internal' ? 'removed' : 'active'}`}>{selectedComponent.category}</span>
            <h3>Purpose</h3>
            <p>{selectedComponent.purpose}</p>
            <h3>Description</h3>
            <p>{selectedComponent.description}</p>
          </div>
          <div className="model-summary"><h3>About this model</h3><p>{firearm.description || 'No model description provided.'}</p></div>
        </aside>}
      </section>
    </main>
  )
}
