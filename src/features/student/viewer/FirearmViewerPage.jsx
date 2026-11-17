import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DashboardLoading from '../../../components/DashboardLoading.jsx'
import AdminModelViewerPanel from '../../admin/AdminModelViewerPanel.jsx'
import AdminIcon from '../../admin/AdminIcon.jsx'
import { supabase } from '../../../lib/supabase.js'
import { getAssessmentAccessState, getAssessmentLockKey, setAssessmentLock } from '../assessment/assessment-lock.js'
import useAuth from '../../../auth/useAuth.js'
import { markFirearmViewed } from './viewed-firearms.js'
import { assessmentAttemptIsSubmitted, selectCurrentAssessmentAttempt } from '../../shared/current-assessment-attempts.js'

// Keep this query limited to the access-control columns used by the assessment
// flow. Some deployed databases do not include the newer audit/timestamp fields;
// requesting those optional columns made a successfully reset attempt look like
// a viewer failure.
const attemptAccessFields = 'id, status, attempt_number, timer_started_at, has_activity, integrity_locked_at, connection_interrupted_at'

export default function FirearmViewerPage() {
  const { profile } = useAuth()
  const { firearmId } = useParams()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId') || ''
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  const [firearm, setFirearm] = useState(null)
  const [assessmentCompleted, setAssessmentCompleted] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessState, setAccessState] = useState('available')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadViewerAccess() {
      if (!profile?.id) return
      setLoading(true)
      setError('')
      if (!classId) {
        setError('Open this firearm from one of your enrolled classes.')
        setLoading(false)
        return
      }

      const [firearmResult, attemptResult, releaseResult] = await Promise.all([
        supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').eq('id', firearmId).single(),
        supabase.from('assessment_attempts').select(attemptAccessFields).eq('student_id', profile.id).eq('class_id', classId).eq('firearm_id', firearmId),
        supabase.from('assessment_releases').select('is_open').eq('class_id', classId).eq('firearm_id', firearmId).maybeSingle(),
      ])

      if (!active) return
      setAssessmentOpen(!releaseResult.error && Boolean(releaseResult.data?.is_open))
      if (firearmResult.error) {
        console.error('Unable to load the firearm record for the student viewer.', firearmResult.error)
        setError('The firearm information could not be loaded. Check your connection, then try again.')
      } else if (attemptResult.error) {
        console.error('Unable to verify assessment access for the student viewer.', attemptResult.error)
        setError('Your assessment access could not be verified. Please try again before opening the firearm.')
      } else {
        const currentAttempt = selectCurrentAssessmentAttempt(attemptResult.data || [])
        const nextAccessState = getAssessmentAccessState(currentAttempt)
        const assessmentStarted = nextAccessState !== 'available'
        setFirearm(firearmResult.data)
        // Whether a faculty member opened or closed an assessment must never
        // affect model loading. Only the student's actual attempt determines
        // whether the viewer is available and whether the shortcut is shown.
        setAssessmentCompleted(assessmentAttemptIsSubmitted(currentAttempt))
        setAccessState(nextAccessState)
        if (!assessmentStarted) {
          // A faculty reset clears the database lock. Remove any stale lock that
          // this browser retained from the previous assessment session as well.
          setAssessmentLock(firearmId, false, classId, profile.id)
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
  }, [classId, firearmId, profile?.id, retryKey])

  useEffect(() => {
    if (!profile?.id) return undefined
    const lockKey = getAssessmentLockKey(firearmId, classId, profile.id)
    function handleStorage(event) {
      if (event.key === lockKey && event.newValue) setAccessState('in_progress')
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [classId, firearmId, profile?.id])

  useEffect(() => {
    if (!profile?.id || !classId) return undefined
    let active = true

    async function refreshViewerLock() {
      const releaseResult = await supabase.from('assessment_releases').select('is_open').eq('class_id', classId).eq('firearm_id', firearmId).maybeSingle()
      if (active) setAssessmentOpen(!releaseResult.error && Boolean(releaseResult.data?.is_open))
      const { data, error: attemptError } = await supabase
        .from('assessment_attempts')
        .select(attemptAccessFields)
        .eq('student_id', profile.id)
        .eq('class_id', classId)
        .eq('firearm_id', firearmId)
      if (active && !attemptError) {
        const currentAttempt = selectCurrentAssessmentAttempt(data || [])
        const nextAccessState = getAssessmentAccessState(currentAttempt)
        setAssessmentCompleted(assessmentAttemptIsSubmitted(currentAttempt))
        setAccessState(nextAccessState)
        if (nextAccessState === 'available') setAssessmentLock(firearmId, false, classId, profile.id)
      }
    }

    const attemptChannel = supabase
      .channel(`student-viewer-attempt:${profile.id}:${classId}:${firearmId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessment_attempts',
        filter: `student_id=eq.${profile.id}`,
      }, () => void refreshViewerLock())
      .subscribe()
    const poll = window.setInterval(() => void refreshViewerLock(), 4000)
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refreshViewerLock()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.clearInterval(poll)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(attemptChannel)
    }
  }, [classId, firearmId, profile?.id])

  if (loading) return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading 3D viewer…" /></main>

  if (error) {
    return <main className="page status-page student-viewer-status-page"><section className="card student-viewer-error-card" role="alert"><span className="student-viewer-status-icon"><AdminIcon name="alertTriangle" /></span><div className="student-viewer-error-copy"><p className="eyebrow">Viewer temporarily unavailable</p><h1>We couldn’t open this firearm</h1><p>{error}</p></div><footer><button className="student-viewer-retry-button" onClick={() => setRetryKey((value) => value + 1)} type="button"><AdminIcon name="reset" />Try again</button><Link className="student-viewer-return-button" to="/student"><AdminIcon name="arrowLeft" />Return to dashboard</Link></footer></section></main>
  }

  if (accessState !== 'available') {
    const paused = accessState === 'paused'
    const integrityLocked = accessState === 'locked'
    const eyebrow = paused ? 'Connection recovery' : integrityLocked ? 'Assessment access locked' : 'Assessment in progress'
    const message = paused
      ? 'Your saved checkpoint is waiting for faculty approval. The firearm model remains locked until the assessment can continue.'
      : integrityLocked
        ? 'The firearm model remains locked until your faculty resets this assessment attempt.'
        : `The ${firearm?.name || 'firearm'} model cannot be inspected while its assessment is in progress.`
    return <main className="page status-page"><section className={`card student-viewer-lock-card ${accessState}`}><p className="eyebrow">{eyebrow}</p><h1>Model viewing is locked</h1><p>{message}</p>{accessState === 'in_progress' && <Link className="assessment-button" to={`/student/models/${firearmId}/assessment${classQuery}`}>Resume assessment</Link>}<Link className="text-link" to="/student">Back to dashboard</Link></section></main>
  }

  const headerLeading = <Link className="student-viewer-back" to="/student" aria-label="Back to class"><AdminIcon name="arrowLeft" /><span>Back to class</span></Link>
  const headerActions = assessmentCompleted || !assessmentOpen ? null : <Link className="student-viewer-assessment" to={`/student/models/${firearmId}/assessment${classQuery}`}>Start Assessment</Link>

  return <AdminModelViewerPanel firearms={[firearm]} headerActions={headerActions} headerLeading={headerLeading} initialFirearmId={firearmId} lockSelection />
}
