import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const FirearmCanvas = lazy(() => import('../student/viewer/FirearmCanvas.jsx'))

function Crosshair() {
  return <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>
}

export default function FirearmCardPreview({ firearm }) {
  const [modelUrl, setModelUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    if (!firearm.glb_storage_path) return undefined
    supabase.storage.from('firearm-models').createSignedUrl(firearm.glb_storage_path, 3600).then(({ data, error }) => {
      if (!active) return
      if (error || !data?.signedUrl) setFailed(true)
      else setModelUrl(data.signedUrl)
    })
    return () => { active = false }
  }, [firearm.glb_storage_path])

  return (
    <div aria-label={`${firearm.name} model preview`} className="admin-firearm-card-preview">
      {modelUrl && !failed
        ? <Suspense fallback={<div className="admin-firearm-card-preview-fallback"><Crosshair /><span>Preparing preview…</span></div>}><FirearmCanvas components={[]} exploded={false} modelUrl={modelUrl} onSelect={() => {}} resetKey={0} selectedName={null} /></Suspense>
        : <div className="admin-firearm-card-preview-fallback"><Crosshair /><span>{failed ? 'Preview unavailable' : 'Loading preview…'}</span></div>}
    </div>
  )
}

