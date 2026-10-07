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
  const [modelUrl, setModelUrl] = useState('')
  const [failed, setFailed] = useState(false)

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
    setModelUrl('')
    setFailed(false)
    void loadFirearmCanvas()
    getFirearmModelUrl(firearm.glb_storage_path, firearm.identifier, firearm.name)
      .then((url) => { if (active) setModelUrl(url) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [firearm.glb_storage_path, firearm.identifier, firearm.name, nearViewport])

  return (
    <div aria-label={`${firearm.name} model preview`} className="admin-firearm-card-preview" ref={previewRef}>
      {modelUrl && !failed
        ? <Suspense fallback={<div className="admin-firearm-card-preview-fallback"><Crosshair /><span>Preparing preview…</span></div>}><FirearmCanvas components={[]} exploded={false} modelUrl={modelUrl} onSelect={() => {}} resetKey={0} selectedName={null} /></Suspense>
        : <div className="admin-firearm-card-preview-fallback"><Crosshair /><span>{failed ? 'Preview unavailable' : 'Loading preview…'}</span></div>}
    </div>
  )
}
