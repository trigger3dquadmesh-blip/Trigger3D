import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DashboardLoading from '../../../components/DashboardLoading.jsx'
import AdminModelViewerPanel from '../../admin/AdminModelViewerPanel.jsx'
import AdminIcon from '../../admin/AdminIcon.jsx'
import { supabase } from '../../../lib/supabase.js'
import { assessmentAttemptHasStarted, getAssessmentLockKey } from '../assessment/assessment-lock.js'
import useAuth from '../../../auth/useAuth.js'
import { markFirearmViewed } from './viewed-firearms.js'

export default function FirearmViewerPage() {
  const { profile } = useAuth()
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

      const [firearmResult, statusResult, attemptResult] = await Promise.all([
        supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').eq('id', firearmId).single(),
        supabase.rpc('get_assessment_status', { target_class_id: classId, target_firearm_id: firearmId }),
        supabase.from('assessment_attempts').select('status, timer_started_at, has_activity').eq('class_id', classId).eq('firearm_id', firearmId).maybeSingle(),
      ])

      if (!active) return
      if (firearmResult.error || statusResult.error || attemptResult.error) {
        setError(firearmResult.error?.message || statusResult.error?.message || attemptResult.error.message)
      } else {
        const assessmentStarted = assessmentAttemptHasStarted(attemptResult.data)
        setFirearm(firearmResult.data)
        setStatus(statusResult.data)
        setLocked(assessmentStarted)
        if (!assessmentStarted) {
          markFirearmViewed(localStorage, profile?.id, classId, firearmId)
          if (profile?.id) {
            void supabase.from('student_firearm_views').upsert({ student_id: profile.id, class_id: classId, firearm_id: firearmId, viewed_at: new Date().toISOString() })
          }
        }
      }
      setLoading(false)
    }

    void loadViewerAccess()
    return () => { active = false }
  }, [classId, firearmId, profile?.id])

  useEffect(() => {
    const lockKey = getAssessmentLockKey(firearmId, classId)
    function handleStorage(event) {
      if (event.key === lockKey && event.newValue) setLocked(true)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [classId, firearmId])

  if (loading) return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading 3D viewer…" /></main>

  if (error) {
    return <main className="page"><section className="card"><p className="eyebrow">Viewer unavailable</p><h1>Unable to open firearm</h1><div className="alert alert-error" role="alert">{error}</div><Link className="text-link" to="/student">Back to dashboard</Link></section></main>
  }

  if (locked) {
    return <main className="page"><section className="card"><p className="eyebrow">Assessment in progress</p><h1>Model viewing is locked</h1><p>The {firearm?.name || 'firearm'} model cannot be inspected while its assessment is in progress.</p><Link className="assessment-button" to={`/student/models/${firearmId}/assessment${classQuery}`}>Resume assessment</Link><Link className="text-link" to="/student">Back to dashboard</Link></section></main>
  }

  const completed = status?.attempt_status === 'submitted'
  const headerLeading = <Link className="student-viewer-back" to="/student" aria-label="Back to class"><AdminIcon name="arrowLeft" /><span>Back to class</span></Link>
  const headerActions = completed ? null : <Link className="student-viewer-assessment" to={`/student/models/${firearmId}/assessment${classQuery}`}>Start Assessment</Link>

  return <AdminModelViewerPanel firearms={[firearm]} headerActions={headerActions} headerLeading={headerLeading} initialFirearmId={firearmId} lockSelection />
}
