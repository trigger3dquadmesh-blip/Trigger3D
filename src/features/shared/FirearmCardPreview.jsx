import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { getFirearmModelUrl } from './firearm-model-url.js'

const loadFirearmCanvas = () => import('../student/viewer/FirearmCanvas.jsx')
const FirearmCanvas = lazy(loadFirearmCanvas)

function Crosshair() {
  return <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>
}

export default function FirearmCardPreview({ firearm }) {
  const previewRef = useRef(null)
  const [nearViewport, setNearViewport] = useState(false)
  const modelKey = `${firearm.glb_storage_path || ''}:${firearm.identifier || ''}:${firearm.name || ''}`
  const [preview, setPreview] = useState({ key: '', modelUrl: '', failed: false })
  const previewIsCurrent = preview.key === modelKey
  const modelUrl = previewIsCurrent ? preview.modelUrl : ''
  const failed = previewIsCurrent && preview.failed

  useEffect(() => {
    const element = previewRef.current
    if (!element) return undefined
    if (!('IntersectionObserver' in window)) {
      const fallbackTimer = window.setTimeout(() => setNearViewport(true), 0)
      return () => window.clearTimeout(fallbackTimer)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true)
        observer.disconnect()
      }
    }, { rootMargin: '240px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    if (!nearViewport) return undefined
    void loadFirearmCanvas()
    getFirearmModelUrl(firearm.glb_storage_path, firearm.identifier, firearm.name)
      .then((url) => { if (active) setPreview({ key: modelKey, modelUrl: url, failed: false }) })
      .catch(() => { if (active) setPreview({ key: modelKey, modelUrl: '', failed: true }) })
    return () => { active = false }
  }, [firearm.glb_storage_path, firearm.identifier, firearm.name, modelKey, nearViewport])

  return (
    <div aria-label={`${firearm.name} model preview`} className="admin-firearm-card-preview" ref={previewRef}>
      {modelUrl && !failed
        ? <Suspense fallback={<div className="admin-firearm-card-preview-fallback"><Crosshair /><span>Preparing preview…</span></div>}><FirearmCanvas components={[]} exploded={false} modelUrl={modelUrl} onSelect={() => {}} resetKey={0} selectedName={null} /></Suspense>
        : <div className="admin-firearm-card-preview-fallback"><Crosshair /><span>{failed ? 'Preview unavailable' : 'Loading preview…'}</span></div>}
    </div>
  )
}
