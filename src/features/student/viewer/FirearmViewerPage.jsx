import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AdminModelViewerPanel from '../../admin/AdminModelViewerPanel.jsx'
import { supabase } from '../../../lib/supabase.js'
import { getAssessmentLockKey } from '../assessment/assessment-lock.js'

export default function FirearmViewerPage() {
  const { firearmId } = useParams()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId') || ''
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  const [firearm, setFirearm] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    let active = true

    async function loadViewerAccess() {
      if (!classId) {
        setError('Open this firearm from one of your enrolled classes.')
        setLoading(false)
        return
      }

      const [firearmResult, statusResult] = await Promise.all([
        supabase.from('firearms').select('id, identifier, name, caliber, status').eq('id', firearmId).single(),
        supabase.rpc('get_assessment_status', { target_class_id: classId, target_firearm_id: firearmId }),
      ])

      if (!active) return
      if (firearmResult.error || statusResult.error) {
        setError(firearmResult.error?.message || statusResult.error.message)
      } else {
        setFirearm(firearmResult.data)
        setStatus(statusResult.data)
        setLocked(statusResult.data.attempt_status === 'in_progress')
      }
      setLoading(false)
    }

    void loadViewerAccess()
    return () => { active = false }
  }, [classId, firearmId])

  useEffect(() => {
    const lockKey = getAssessmentLockKey(firearmId, classId)
    function handleStorage(event) {
      if (event.key === lockKey && event.newValue) setLocked(true)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [classId, firearmId])

  if (loading) return <main className="page status-page">Loading 3D viewer...</main>

  if (error) {
    return <main className="page"><section className="card"><p className="eyebrow">Viewer unavailable</p><h1>Unable to open firearm</h1><div className="alert alert-error" role="alert">{error}</div><Link className="text-link" to="/student">Back to dashboard</Link></section></main>
  }

  if (locked) {
    return <main className="page"><section className="card"><p className="eyebrow">Assessment in progress</p><h1>Model viewing is locked</h1><p>The {firearm?.name || 'firearm'} model cannot be inspected while its assessment is in progress.</p><Link className="assessment-button" to={`/student/models/${firearmId}/assessment${classQuery}`}>Resume assessment</Link><Link className="text-link" to="/student">Back to dashboard</Link></section></main>
  }

  const completed = status?.attempt_status === 'submitted'
  const assessmentLabel = completed ? 'View Result' : 'Start Assessment'
  const headerLeading = <Link className="student-viewer-back" to="/student" aria-label="Back to class">← <span>Back to class</span></Link>
  const headerActions = <Link className="student-viewer-assessment" to={`/student/models/${firearmId}/assessment${classQuery}`}>{assessmentLabel}</Link>

  return <AdminModelViewerPanel firearms={[firearm]} headerActions={headerActions} headerLeading={headerLeading} initialFirearmId={firearmId} lockSelection />
}
