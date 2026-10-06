import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DashboardLoading from '../../../components/DashboardLoading.jsx'
import AdminIcon from '../../admin/AdminIcon.jsx'
import { supabase } from '../../../lib/supabase.js'
import useAuth from '../../../auth/useAuth.js'
import { allQuestionsAnswered, buildSubmission, isAnswered } from './assessment-utils.js'
import {
  createAssessmentDraft,
  getAssessmentDraftKey,
  restoreAssessmentDraft,
} from './assessment-draft.js'
import { setAssessmentLock, setAssessmentNavigationLock } from './assessment-lock.js'
import { clearActiveAssessmentSession, markActiveAssessmentSession } from './assessment-session.js'
import {
  createAssessmentTimeState,
  formatAssessmentTime,
  getAssessmentTimeStateKey,
  normalizeAssessmentDuration,
  restoreAssessmentTimeState,
} from './assessment-duration.js'

const NO_ANSWER = '[No answer]'
const TIME_EXPIRED_ANSWER = '[No answer: assessment time expired]'
const REVIEW_PAGE_SIZE = 5
const CONNECTION_CHECK_INTERVAL_MS = 8000
const CONNECTION_CHECK_TIMEOUT_MS = 5000

async function saveCheckpointWithTimeout(payload) {
  let timeoutId
  const timeoutResult = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => resolve({
      error: new Error('The connection check timed out.'),
      timedOut: true,
    }), CONNECTION_CHECK_TIMEOUT_MS)
  })
  const result = await Promise.race([
    supabase.rpc('save_assessment_checkpoint', payload),
    timeoutResult,
  ])
  window.clearTimeout(timeoutId)
  return result
}

function readStoredDraft(attemptId) {
  try {
    return localStorage.getItem(getAssessmentDraftKey(attemptId))
  } catch {
    return null
  }
}

function removeStoredDraft(attemptId) {
  try {
    localStorage.removeItem(getAssessmentDraftKey(attemptId))
  } catch {
    // Draft cleanup is best-effort in browsers that restrict local Storage.
  }
}

export default function AssessmentPage() {
  const { user } = useAuth()
  const { firearmId } = useParams()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId') || ''
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  const [firearm, setFirearm] = useState(null)
  const [classItem, setClassItem] = useState(null)
  const [status, setStatus] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [attemptStartedAt, setAttemptStartedAt] = useState(null)
  const [activityRecorded, setActivityRecorded] = useState(false)
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [review, setReview] = useState([])
  const [reviewPage, setReviewPage] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [integrityWarningAccepted, setIntegrityWarningAccepted] = useState(false)
  const [startConfirmationOpen, setStartConfirmationOpen] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [integrityBlocked, setIntegrityBlocked] = useState(null)
  const [connectionInterrupted, setConnectionInterrupted] = useState(null)
  const [error, setError] = useState('')
  const timeoutSubmittedRef = useRef(false)
  const answersRef = useRef({})
  const integrityViolationRef = useRef(false)
  const assessmentFinishedRef = useRef(false)
  const assessmentPageMountedRef = useRef(false)
  const connectionInterruptedRef = useRef(false)
  const connectionReportConfirmedRef = useRef(false)
  const connectionReportInProgressRef = useRef(false)
  const currentIndexRef = useRef(0)
  const timeRemainingRef = useRef(0)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  useEffect(() => {
    currentIndexRef.current = currentIndex
    timeRemainingRef.current = timeRemaining
  }, [currentIndex, timeRemaining])

  useEffect(() => {
    setAssessmentNavigationLock(questions.length > 0 && !result && !integrityBlocked && !connectionInterrupted)
    return () => setAssessmentNavigationLock(false)
  }, [connectionInterrupted, integrityBlocked, questions.length, result])

  useEffect(() => {
    let active = true

    async function loadAssessment() {
      if (!classId) {
        setError('Open this assessment from one of your enrolled classes.')
        setLoading(false)
        return
      }
      const [firearmResult, classResult, statusResult, releaseResult] = await Promise.all([
        supabase
          .from('firearms')
          .select('id, name, caliber')
          .eq('id', firearmId)
          .single(),
        supabase.from('classes').select('id, name').eq('id', classId).single(),
        supabase.rpc('get_assessment_status', { target_class_id: classId, target_firearm_id: firearmId }),
        supabase.from('assessment_releases').select('duration_minutes').eq('class_id', classId).eq('firearm_id', firearmId).single(),
      ])

      if (!active) return

      if (firearmResult.error || classResult.error || statusResult.error || releaseResult.error) {
        setError(firearmResult.error?.message || classResult.error?.message || statusResult.error?.message || releaseResult.error.message)
      } else {
        setFirearm(firearmResult.data)
        setClassItem(classResult.data)
        setStatus(statusResult.data)
        setDurationMinutes(normalizeAssessmentDuration(releaseResult.data.duration_minutes))
        if (statusResult.data.attempt_status === 'submitted') {
          assessmentFinishedRef.current = true
          setAssessmentLock(firearmId, false, classId)
          if (statusResult.data.attempt_id) {
            clearActiveAssessmentSession(sessionStorage, user?.id, statusResult.data.attempt_id)
            removeStoredDraft(statusResult.data.attempt_id)
            removeStoredTime(statusResult.data.attempt_id)
            setAttemptId(statusResult.data.attempt_id)
          }
          setResult({
            correct_count: statusResult.data.correct_count,
            total_questions: statusResult.data.total_questions,
            percentage: statusResult.data.percentage,
          })
        } else if (statusResult.data.attempt_status === 'in_progress') {
          const { data: integrityStatus, error: integrityError } = await supabase.rpc(
            'get_my_assessment_integrity_status',
            { target_attempt_id: statusResult.data.attempt_id },
          )
          if (integrityError) {
            setError(integrityError.message)
          } else if (integrityStatus?.is_locked) {
            setIntegrityBlocked(integrityStatus)
          }
          const { data: checkpoint } = await supabase.rpc('get_my_assessment_checkpoint', {
            target_attempt_id: statusResult.data.attempt_id,
          })
          if (checkpoint?.connection_interrupted_at) {
            connectionInterruptedRef.current = true
            setConnectionInterrupted({
              approved: false,
              reported: true,
              questionIndex: checkpoint.question_index,
              remainingSeconds: checkpoint.remaining_seconds,
            })
          }
          setAssessmentLock(firearmId, true, classId)
          markActiveAssessmentSession(sessionStorage, user?.id, statusResult.data.attempt_id)
        }
      }

      setLoading(false)
    }

    void loadAssessment()
    return () => { active = false }
  }, [classId, firearmId, user?.id])

  useEffect(() => {
    if (!result || !attemptId) return undefined
    let active = true

    async function loadReview() {
      setReviewLoading(true)
      setReviewError('')
      const { data, error: responseError } = await supabase.rpc('get_my_assessment_review', {
        target_attempt_id: attemptId,
      })

      if (!active) return
      if (responseError) {
        const missingFunction = responseError.code === 'PGRST202'
          || responseError.message?.includes('get_my_assessment_review')
        setReviewError(missingFunction
          ? 'The student answer-review database update has not been installed yet.'
          : `Your grade is available, but the answer review could not be loaded. ${responseError.message}`)
        setReview([])
      } else {
        const rows = (data ?? []).map((row) => {
          return {
            id: `${row.attempt_id}:${row.question_id}`,
            label: row.question_id,
            prompt: row.prompt || 'Component identification question',
            correctAnswer: row.component_name || '',
            studentAnswer: row.student_answer || NO_ANSWER,
            isCorrect: Boolean(row.is_correct),
          }
        }).sort((left, right) => String(left.label).localeCompare(String(right.label), undefined, { numeric: true }))
        setReview(rows)
        setReviewPage(0)
      }
      setReviewLoading(false)
    }

    void loadReview()
    return () => { active = false }
  }, [attemptId, result])

  const currentQuestion = questions[currentIndex] ?? null
  const canSubmit = useMemo(
    () => allQuestionsAnswered(questions, answers),
    [answers, questions],
  )

  useEffect(() => {
    if (!attemptId || result) return undefined
    const poll = window.setInterval(async () => {
      const { data } = await supabase.rpc('get_assessment_status', {
        target_class_id: classId,
        target_firearm_id: firearmId,
      })
      if (data?.attempt_status !== 'submitted') return
      assessmentFinishedRef.current = true
      removeStoredDraft(attemptId)
      removeStoredTime(attemptId)
      setAssessmentLock(firearmId, false, classId)
      clearActiveAssessmentSession(sessionStorage, user?.id, attemptId)
      setResult({
        correct_count: data.correct_count,
        total_questions: data.total_questions,
        percentage: data.percentage,
      })
    }, 4000)
    return () => window.clearInterval(poll)
  }, [attemptId, classId, firearmId, result, user?.id])

  useEffect(() => {
    if (!attemptId || !attemptStartedAt || !questions.length || result) return

    try {
      localStorage.setItem(
        getAssessmentDraftKey(attemptId),
        createAssessmentDraft({ answers, attemptStartedAt, currentIndex, questions }),
      )
    } catch {
      // Draft recovery is best-effort; Storage restrictions must not block an assessment.
    }
  }, [answers, attemptId, attemptStartedAt, currentIndex, questions, result])

  async function startAssessment() {
    setStarting(true)
    setError('')

    const { data, error: startError } = await supabase.rpc('start_assessment', {
      target_class_id: classId,
      target_firearm_id: firearmId,
    })

    if (startError) {
      setError(startError.message)
      setStarting(false)
      return false
    } else if (!data?.length) {
      setError('No assessment questions are available for this firearm.')
      setStarting(false)
      return false
    } else {
      const { data: timerStartedAt, error: timerError } = await supabase.rpc(
        'begin_assessment_timer',
        { target_attempt_id: data[0].attempt_id },
      )
      if (timerError || !timerStartedAt) {
        setError(timerError?.message || 'The assessment timer could not be started.')
        setStarting(false)
        return false
      }

      const [{ data: refreshedStatus, error: statusError }, { data: checkpoint }] = await Promise.all([
        supabase.rpc(
        'get_assessment_status',
        { target_class_id: classId, target_firearm_id: firearmId },
        ),
        supabase.rpc('get_my_assessment_checkpoint', { target_attempt_id: data[0].attempt_id }),
      ])
      const attemptRevision = statusError ? timerStartedAt : refreshedStatus.attempt_started_at
      const maximumSeconds = durationMinutes * 60
      const restoredTime = restoreAssessmentTimeState(
        readStoredTime(data[0].attempt_id),
        { attemptStartedAt: attemptRevision, maximumSeconds },
      )
      const draft = attemptRevision
        ? restoreAssessmentDraft(
            readStoredDraft(data[0].attempt_id),
            { attemptStartedAt: attemptRevision, questions: data },
          )
        : { answers: {}, currentIndex: 0 }
      const serverRemaining = Number.isInteger(checkpoint?.remaining_seconds)
        ? checkpoint.remaining_seconds
        : null
      const resumedTime = [restoredTime, serverRemaining]
        .filter((value) => Number.isInteger(value))
        .reduce((lowest, value) => Math.min(lowest, value), maximumSeconds)
      const serverIndex = Math.min(
        Math.max(Number(checkpoint?.question_index) || 0, 0),
        Math.max(data.length - 1, 0),
      )

      setQuestions(data)
      setAssessmentLock(firearmId, true, classId)
      markActiveAssessmentSession(sessionStorage, user?.id, data[0].attempt_id)
      setAttemptId(data[0].attempt_id)
      setAttemptStartedAt(attemptRevision)
      setTimeRemaining(resumedTime)
      setActivityRecorded(false)
      setAnswers({ ...(checkpoint?.answers || {}), ...draft.answers })
      setCurrentIndex(Math.max(draft.currentIndex, serverIndex))
      if (!statusError) setStatus(refreshedStatus)
    }

    setStarting(false)
    return true
  }

  async function submitAssessment(submittedAnswers = answers) {
    if (!allQuestionsAnswered(questions, submittedAnswers) || !attemptId) return
    timeoutSubmittedRef.current = true
    setSubmitting(true)
    setError('')

    const { data, error: submitError } = await supabase.rpc('submit_assessment', {
      target_attempt_id: attemptId,
      submitted_answers: buildSubmission(questions, submittedAnswers),
    })

    if (submitError) setError(submitError.message)
    else {
      assessmentFinishedRef.current = true
      removeStoredDraft(attemptId)
      removeStoredTime(attemptId)
      setAssessmentLock(firearmId, false, classId)
      clearActiveAssessmentSession(sessionStorage, user?.id, attemptId)
      setResult(data)
      if (document.fullscreenElement) void document.exitFullscreen()
    }

    setSubmitting(false)
  }

  async function saveAnswer(question, answer) {
    if (!attemptId || !question || !isAnswered(answer)) return true
    const { error: saveError } = await supabase.rpc('save_assessment_response', {
      target_attempt_id: attemptId,
      target_question_id: question.question_record_id,
      submitted_answer: answer.trim(),
    })
    if (saveError) {
      setError(saveError.message)
      return false
    }
    await supabase.rpc('save_assessment_checkpoint', {
      target_attempt_id: attemptId,
      target_question_index: Math.min(currentIndex + 1, Math.max(questions.length - 1, 0)),
      target_remaining_seconds: timeRemaining,
    })
    return true
  }

  async function advanceQuestion() {
    if (!currentQuestion || !isAnswered(currentAnswer) || submitting) return
    if (!await saveAnswer(currentQuestion, currentAnswer)) return
    if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1)
    else if (canSubmit) await submitAssessment()
  }

  async function confirmStartAssessment() {
    setError('')
    if (!document.fullscreenEnabled) {
      setStartConfirmationOpen(false)
      setError('Fullscreen mode is required, but this browser does not currently allow it.')
      return
    }

    try {
      await document.documentElement.requestFullscreen()
    } catch {
      setStartConfirmationOpen(false)
      setError('Fullscreen mode is required to begin this assessment. Please allow fullscreen and try again.')
      return
    }

    setStartConfirmationOpen(false)
    const started = await startAssessment()
    if (!started && document.fullscreenElement) void document.exitFullscreen()
  }

  async function lockAssessmentForIntegrity(reason) {
    if (!attemptId || integrityViolationRef.current || assessmentFinishedRef.current || connectionInterruptedRef.current) return
    integrityViolationRef.current = true
    const messages = {
      fullscreen_exited: 'Fullscreen mode was exited.',
      page_hidden: 'The assessment page was hidden or another tab was opened.',
      window_blurred: 'Focus moved away from the assessment window.',
      assessment_page_left: 'The student navigated away from the active assessment page.',
    }
    const { error: lockError } = await supabase.rpc('lock_assessment_for_integrity', {
      target_attempt_id: attemptId,
      violation_reason: reason,
    })
    clearActiveAssessmentSession(sessionStorage, user?.id, attemptId)
    setAssessmentLock(firearmId, false, classId)
    setIntegrityBlocked({
      is_locked: true,
      reason,
      message: lockError
        ? `${messages[reason]} The lock could not be confirmed: ${lockError.message}`
        : messages[reason],
    })
    if (document.fullscreenElement) void document.exitFullscreen()
  }

  async function recordAssessmentActivity() {
    if (!attemptId || activityRecorded) return

    const { error: activityError } = await supabase.rpc('record_assessment_activity', {
      target_attempt_id: attemptId,
    })

    if (!activityError) setActivityRecorded(true)
  }

  useEffect(() => {
    timeoutSubmittedRef.current = false
    integrityViolationRef.current = false
  }, [attemptId])

  useEffect(() => {
    if (!attemptId || !questions.length || result || integrityBlocked) return undefined

    function pauseForConnectionInterruption() {
      if (connectionInterruptedRef.current) return
      connectionInterruptedRef.current = true
      connectionReportConfirmedRef.current = false
      setConnectionInterrupted({
        approved: false,
        reported: false,
        reporting: false,
        questionIndex: currentIndexRef.current,
        remainingSeconds: timeRemainingRef.current,
        reportError: '',
      })
    }

    async function reportInterruption() {
      if (!connectionInterruptedRef.current || connectionReportConfirmedRef.current || connectionReportInProgressRef.current) return
      connectionReportInProgressRef.current = true
      setConnectionInterrupted((current) => current ? { ...current, reporting: true, reportError: '' } : current)
      const { error: reportError, timedOut } = await Promise.race([
        supabase.rpc('report_assessment_connection_interruption', {
          target_attempt_id: attemptId,
          target_question_index: currentIndexRef.current,
          target_remaining_seconds: timeRemainingRef.current,
        }),
        new Promise((resolve) => window.setTimeout(() => resolve({
          error: new Error('The request timed out.'),
          timedOut: true,
        }), CONNECTION_CHECK_TIMEOUT_MS)),
      ])
      connectionReportInProgressRef.current = false
      connectionReportConfirmedRef.current = !reportError
      setConnectionInterrupted((current) => current ? {
        ...current,
        reported: !reportError,
        reporting: false,
        reportError: reportError && !timedOut ? reportError.message : '',
      } : current)
    }

    function handleOffline() { pauseForConnectionInterruption() }

    function handleOnline() { void reportInterruption() }
    const reportRetryTimer = window.setInterval(() => {
      if (connectionInterruptedRef.current) void reportInterruption()
    }, 3000)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.clearInterval(reportRetryTimer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [attemptId, integrityBlocked, questions.length, result])

  useEffect(() => {
    if (!attemptId || !connectionInterrupted?.reported || connectionInterrupted.approved) return undefined
    const poll = window.setInterval(async () => {
      const { data } = await supabase.rpc('get_my_assessment_checkpoint', { target_attempt_id: attemptId })
      if (data && !data.connection_interrupted_at) {
        setConnectionInterrupted((current) => current ? { ...current, approved: true } : current)
      }
    }, 4000)
    return () => window.clearInterval(poll)
  }, [attemptId, connectionInterrupted])

  useEffect(() => {
    if (!attemptId || !attemptStartedAt || !questions.length || result || connectionInterrupted) return undefined
    const timer = window.setInterval(() => {
      setTimeRemaining((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [attemptId, attemptStartedAt, connectionInterrupted, questions.length, result])

  useEffect(() => {
    if (!attemptId || !attemptStartedAt || !questions.length || result) return
    try {
      localStorage.setItem(
        getAssessmentTimeStateKey(attemptId),
        createAssessmentTimeState({ attemptStartedAt, remainingSeconds: timeRemaining }),
      )
    } catch {
      // Timer recovery is best-effort; Storage restrictions must not block an assessment.
    }
  }, [attemptId, attemptStartedAt, questions.length, result, timeRemaining])

  useEffect(() => {
    if (!attemptId || !questions.length || result || integrityBlocked || connectionInterrupted) return undefined
    let checkInProgress = false

    async function verifyConnectionAndSaveCheckpoint() {
      if (checkInProgress || connectionInterruptedRef.current) return
      if (!navigator.onLine) {
        connectionInterruptedRef.current = true
        setConnectionInterrupted({ approved: false, reported: false, questionIndex: currentIndexRef.current, remainingSeconds: timeRemainingRef.current, reportError: '' })
        return
      }

      checkInProgress = true
      const { error: checkpointError, timedOut } = await saveCheckpointWithTimeout({
        target_attempt_id: attemptId,
        target_question_index: currentIndexRef.current,
        target_remaining_seconds: timeRemainingRef.current,
      })
      checkInProgress = false
      const looksLikeNetworkFailure = timedOut
        || /failed to fetch|networkerror|network request failed|load failed|err_network/i.test(checkpointError?.message || '')
      if (!looksLikeNetworkFailure || connectionInterruptedRef.current) return
      connectionInterruptedRef.current = true
      setConnectionInterrupted({ approved: false, reported: false, questionIndex: currentIndexRef.current, remainingSeconds: timeRemainingRef.current, reportError: '' })
    }

    const checkpointTimer = window.setInterval(() => {
      void verifyConnectionAndSaveCheckpoint()
    }, CONNECTION_CHECK_INTERVAL_MS)
    return () => window.clearInterval(checkpointTimer)
  }, [attemptId, connectionInterrupted, integrityBlocked, questions.length, result])

  useEffect(() => {
    if (!attemptId || !questions.length || result || timeRemaining > 0 || timeoutSubmittedRef.current) return
    timeoutSubmittedRef.current = true
    const timedAnswers = Object.fromEntries(questions.map((question) => {
      const answer = answersRef.current[question.question_record_id]
      return [question.question_record_id, isAnswered(answer) ? answer : TIME_EXPIRED_ANSWER]
    }))
    setAnswers(timedAnswers)
    void submitAssessment(timedAnswers)
    // Timeout submission consumes the current assessment snapshot and runs only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, questions, result, timeRemaining])

  useEffect(() => {
    if (!attemptId || !questions.length || result || integrityBlocked || connectionInterrupted) return undefined

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) void lockAssessmentForIntegrity('fullscreen_exited')
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void lockAssessmentForIntegrity('page_hidden')
    }
    const handleWindowBlur = () => void lockAssessmentForIntegrity('window_blurred')

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    if (!document.fullscreenElement) void lockAssessmentForIntegrity('fullscreen_exited')

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
    }
    // Integrity handlers intentionally bind to the active attempt snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, connectionInterrupted, integrityBlocked, questions.length, result])

  useEffect(() => {
    if (!attemptId || !questions.length || result) return undefined
    assessmentPageMountedRef.current = true

    return () => {
      assessmentPageMountedRef.current = false
      window.setTimeout(() => {
        if (assessmentPageMountedRef.current || assessmentFinishedRef.current || integrityViolationRef.current || connectionInterruptedRef.current) return
        integrityViolationRef.current = true
        void supabase.rpc('lock_assessment_for_integrity', {
          target_attempt_id: attemptId,
          violation_reason: 'assessment_page_left',
        })
      }, 0)
    }
  }, [attemptId, questions.length, result])

  if (loading) return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading assessment…" /></main>

  if (error && !firearm) {
    return (
      <main className="page">
        <section className="card">
          <h1>Assessment unavailable</h1>
          <div className="alert alert-error" role="alert">{error}</div>
          <Link to="/student">Back to dashboard</Link>
        </section>
      </main>
    )
  }

  if (connectionInterrupted) {
    async function resumeApprovedAttempt() {
      try {
        await document.documentElement.requestFullscreen()
      } catch {
        setError('Fullscreen mode is required to resume this assessment.')
        return
      }
      connectionInterruptedRef.current = false
      connectionReportConfirmedRef.current = false
      setConnectionInterrupted(null)
      await startAssessment()
    }

    const recoveryMessage = connectionInterrupted.approved
      ? 'Your faculty approved your continuation. Resume when you are ready.'
      : connectionInterrupted.reported
        ? `Your continuation request was sent to your faculty. Your saved checkpoint is question ${Number(connectionInterrupted.questionIndex || 0) + 1}.`
        : !navigator.onLine
          ? 'Your internet connection is unavailable. Keep this page open while Trigger3D waits to reconnect.'
          : connectionInterrupted.reporting
            ? 'Sending your continuation request to your faculty…'
            : 'Reconnected. Trigger3D is sending your continuation request to your faculty.'

    return <main className="student-assessment-page student-assessment-complete"><section className="student-assessment-result student-assessment-integrity-blocked" role="alert"><span className="student-assessment-result-icon"><AdminIcon name="alertTriangle" /></span><p className="eyebrow">Connection recovery</p><h1>{connectionInterrupted.approved ? 'Continuation approved' : connectionInterrupted.reported ? 'Waiting for faculty approval' : 'Your assessment was paused'}</h1><p>{recoveryMessage}</p><p>Your saved answers, current question, and remaining time are protected. You cannot resume until your faculty approves the request.</p>{connectionInterrupted.reportError && <div className="alert alert-error" role="alert">The request could not be sent yet. Trigger3D will keep retrying automatically.</div>}<footer>{connectionInterrupted.approved ? <button className="primary" onClick={() => void resumeApprovedAttempt()} type="button">Resume in fullscreen</button> : connectionInterrupted.reported ? <Link className="primary" to="/student">Return to student dashboard</Link> : null}</footer></section></main>
  }

  if (integrityBlocked) {
    const violationMessage = integrityBlocked.message || {
      fullscreen_exited: 'Fullscreen mode was exited during the assessment.',
      page_hidden: 'The assessment page was hidden or another tab was opened.',
      window_blurred: 'Focus moved away from the assessment window.',
      assessment_page_left: 'The active assessment page was exited before submission.',
    }[integrityBlocked.reason] || 'An assessment integrity rule was violated.'
    return (
      <main className="student-assessment-page student-assessment-complete">
        <section className="student-assessment-result student-assessment-integrity-blocked" role="alert">
          <span className="student-assessment-result-icon"><AdminIcon name="alertTriangle" /></span>
          <p className="eyebrow">Assessment access locked</p>
          <h1>You can no longer continue this attempt</h1>
          <p>{violationMessage}</p>
          <p>Your faculty instructor must reset the attempt before you can take this assessment again.</p>
          <footer><Link className="primary" to="/student">Return to student dashboard</Link></footer>
        </section>
      </main>
    )
  }

  if (result) {
    const incorrectCount = review.filter((item) => !item.isCorrect).length
    const reviewPageCount = Math.ceil(review.length / REVIEW_PAGE_SIZE)
    const reviewStart = reviewPage * REVIEW_PAGE_SIZE
    const reviewItems = review.slice(reviewStart, reviewStart + REVIEW_PAGE_SIZE)
    return (
      <main className="student-assessment-page student-assessment-complete">
        <div className="student-assessment-back"><Link onClick={() => localStorage.setItem('trigger3d.student.active-page', 'results')} to="/student"><AdminIcon name="arrowLeft" />Back to My Results</Link></div>
        <section className="student-assessment-result">
          <span className="student-assessment-result-icon">✓</span>
          <p className="eyebrow">Assessment complete</p>
          <h1>{firearm.name}</h1>
          <strong>{Number(result.percentage).toFixed(2)}%</strong>
          <p>{result.correct_count} of {result.total_questions} answers correct</p>
          <footer>
            <Link to={`/student/models/${firearmId}${classQuery}`}>Return to model</Link>
            <Link className="primary" to="/student">Student dashboard</Link>
          </footer>
        </section>
        <section className="student-answer-review" aria-labelledby="answer-review-title">
          <header><div><p className="eyebrow">Personal analytics</p><h2 id="answer-review-title">Answer review</h2></div>{!reviewLoading && review.length > 0 && <span>{incorrectCount} to review</span>}</header>
          {reviewLoading && <p className="student-review-message">Loading your answers...</p>}
          {reviewError && <div className="alert alert-error" role="alert">{reviewError}</div>}
          {!reviewLoading && !reviewError && review.length === 0 && <p className="student-review-message">No answer details are available for this assessment.</p>}
          {reviewItems.length > 0 && <>
            <div className="student-review-progress"><span>Questions {reviewStart + 1}–{Math.min(reviewStart + REVIEW_PAGE_SIZE, review.length)} of {review.length}</span><progress max={review.length} value={Math.min(reviewStart + REVIEW_PAGE_SIZE, review.length)} /></div>
            <div className="student-review-list">
              {reviewItems.map((item, index) => <article className={item.isCorrect ? 'correct' : 'incorrect'} key={item.id}>
                <span aria-label={item.isCorrect ? 'Correct answer' : 'Incorrect answer'}>{item.isCorrect ? '✓' : '×'}</span>
                <div><small>Question {reviewStart + index + 1} · {item.isCorrect ? 'Correct' : 'Needs review'}</small><h3>{item.prompt}</h3><p><b>Your answer:</b> {item.studentAnswer}</p>{!item.isCorrect && <p><b>Correct answer:</b> {item.correctAnswer ? item.correctAnswer.replaceAll('_', ' ') : 'Not available'}</p>}</div>
              </article>)}
            </div>
            <footer className="student-review-controls"><button disabled={reviewPage === 0} onClick={() => setReviewPage((page) => Math.max(0, page - 1))} type="button">← Previous</button><span>Page {reviewPage + 1} of {reviewPageCount}</span><button disabled={reviewPage >= reviewPageCount - 1} onClick={() => setReviewPage((page) => Math.min(reviewPageCount - 1, page + 1))} type="button">Next →</button></footer>
          </>}
        </section>
      </main>
    )
  }

  if (questions.length === 0) {
    const released = status?.is_released
    return (
      <main className="student-assessment-page">
        <div className="student-assessment-back"><Link to="/student"><AdminIcon name="arrowLeft" />Back to class</Link></div>
        <section className="student-assessment-intro">
          <header><p className="eyebrow">{classItem?.name || 'Class assessment'}</p><h1>{firearm.name} Component Analysis</h1><span>{firearm.name}</span></header>
          <div className="student-assessment-facts"><div><strong>{status?.question_count || status?.total_questions || 'Not available'}</strong><span>Questions</span></div><div><strong>{durationMinutes} minutes</strong><span>Total time for all questions</span></div></div>
          <div className="student-assessment-instructions">
            <h2>Before you begin</h2>
            <p><span>○</span> You have {durationMinutes} minutes for the complete assessment. Manage this time across all questions.</p>
            <p><span>△</span> Review each response before continuing. You cannot return to a previous question.</p>
            <p><span>◇</span> Access to the 3D model viewer is disabled during an active attempt.</p>
            <p><span>✓</span> Your progress is saved automatically after every question.</p>
          </div>
          <div className="student-assessment-integrity-warning" role="alert">
            <div><AdminIcon name="alertTriangle" /><p><strong>Academic integrity warning</strong><span>Once the assessment begins, opening another tab or window, switching away from this page, or exiting fullscreen mode will ban you from taking this assessment.</span></p></div>
            <label><input checked={integrityWarningAccepted} onChange={(event) => setIntegrityWarningAccepted(event.target.checked)} type="checkbox" />I understand and agree to remain on this assessment in fullscreen mode.</label>
          </div>
          <div className="student-assessment-passing">Passing score: <strong>75%</strong>. Your result will be available immediately after submission.</div>
          {!released && (
            <div className="alert" role="status">
              This assessment is locked until your Faculty instructor opens it.
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <footer>
            <Link to={status?.attempt_status === 'in_progress'
              ? '/student'
              : `/student/models/${firearmId}${classQuery}`}>
              Cancel
            </Link>
            <button className="student-assessment-primary" type="button" onClick={() => setStartConfirmationOpen(true)} disabled={!released || starting || !integrityWarningAccepted}>
              {starting
                ? 'Loading questions...'
                : status?.attempt_status === 'in_progress' ? 'Resume Assessment' : 'Begin Assessment'}
            </button>
          </footer>
        </section>
        {startConfirmationOpen && <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !starting) setStartConfirmationOpen(false) }} role="presentation">
          <section aria-labelledby="assessment-start-confirmation-title" aria-modal="true" className="confirmation-dialog student-assessment-start-dialog" role="dialog">
            <div className="student-assessment-start-dialog-icon"><AdminIcon name="alertTriangle" /></div>
            <p className="eyebrow">Final confirmation</p>
            <h2 id="assessment-start-confirmation-title">Are you ready to begin?</h2>
            <p>Please confirm that you understand the assessment rules. You will have {durationMinutes} minutes for all questions, and the assessment will submit automatically when time expires.</p>
            <div className="student-assessment-start-reminder"><strong>Remember:</strong> Opening another tab or window, switching away from this page, or exiting fullscreen will immediately lock this assessment attempt.</div>
            <div className="confirmation-actions">
              <button disabled={starting} onClick={() => setStartConfirmationOpen(false)} type="button">Not yet</button>
              <button className="faculty-primary-action" disabled={starting} onClick={() => void confirmStartAssessment()} type="button">{starting ? 'Starting…' : 'Yes, I’m ready'}</button>
            </div>
          </section>
        </div>}
      </main>
    )
  }

  const currentAnswer = answers[currentQuestion.question_record_id] ?? ''

  return (
    <main className="student-assessment-page student-assessment-active">
      <div className="student-assessment-progress"><div><span>Question {currentIndex + 1} of {questions.length}</span><strong className={timeRemaining <= 60 ? 'ending' : ''} aria-label={`${formatAssessmentTime(timeRemaining)} remaining`}>{formatAssessmentTime(timeRemaining)} remaining</strong></div><progress value={currentIndex + 1} max={questions.length} /></div>
      <section className="student-question-card">
        <header><p>Question {currentIndex + 1}</p></header>
        <div className="student-question-body">
          {currentQuestion.image_file && <div className="student-question-asset">Question image: {currentQuestion.image_file}</div>}
          <h1>{currentQuestion.prompt}</h1>
          <label className="student-question-answer">Your answer<input value={currentAnswer} onChange={(event) => { setAnswers((current) => ({ ...current, [currentQuestion.question_record_id]: event.target.value })); void recordAssessmentActivity() }} onKeyDown={(event) => { if (event.key !== 'Enter' || !isAnswered(currentAnswer) || submitting) return; event.preventDefault(); void advanceQuestion() }} placeholder="Type the component name..." autoFocus autoComplete="off" disabled={submitting} /></label>
          <small>Press Enter or select Submit &amp; Next to continue.</small>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
        </div>
        <footer><button className="student-assessment-primary" type="button" onClick={() => void advanceQuestion()} disabled={!isAnswered(currentAnswer) || submitting}>{submitting ? 'Submitting...' : currentIndex < questions.length - 1 ? 'Submit & Next' : 'Submit Assessment'}</button></footer>
      </section>
      <p className="student-assessment-draft-note">Do not close or refresh this tab. Your progress is saved automatically.</p>
    </main>
  )
}

function readStoredTime(attemptId) {
  try {
    return localStorage.getItem(getAssessmentTimeStateKey(attemptId))
  } catch {
    return null
  }
}

function removeStoredTime(attemptId) {
  try {
    localStorage.removeItem(getAssessmentTimeStateKey(attemptId))
  } catch {
    // Timer cleanup is best-effort in browsers that restrict local Storage.
  }
}
