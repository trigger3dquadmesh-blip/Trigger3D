import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase.js'
import { allQuestionsAnswered, buildSubmission, isAnswered } from './assessment-utils.js'
import {
  createAssessmentDraft,
  getAssessmentDraftKey,
  restoreAssessmentDraft,
} from './assessment-draft.js'
import { setAssessmentLock } from './assessment-lock.js'
import { createQuestionDeadline, secondsUntilDeadline } from './assessment-timer.js'

const QUESTION_TIME_SECONDS = 30
const TIMED_OUT_ANSWER = '[No answer — time expired]'

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
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME_SECONDS)
  const [error, setError] = useState('')
  const handledTimeoutRef = useRef('')
  const questionDeadlineRef = useRef(0)

  useEffect(() => {
    let active = true

    async function loadAssessment() {
      if (!classId) {
        setError('Open this assessment from one of your enrolled classes.')
        setLoading(false)
        return
      }
      const [firearmResult, classResult, statusResult] = await Promise.all([
        supabase
          .from('firearms')
          .select('id, name, caliber')
          .eq('id', firearmId)
          .single(),
        supabase.from('classes').select('id, name').eq('id', classId).single(),
        supabase.rpc('get_assessment_status', { target_class_id: classId, target_firearm_id: firearmId }),
      ])

      if (!active) return

      if (firearmResult.error || classResult.error || statusResult.error) {
        setError(firearmResult.error?.message || classResult.error?.message || statusResult.error.message)
      } else {
        setFirearm(firearmResult.data)
        setClassItem(classResult.data)
        setStatus(statusResult.data)
        if (statusResult.data.attempt_status === 'submitted') {
          setAssessmentLock(firearmId, false, classId)
          if (statusResult.data.attempt_id) {
            removeStoredDraft(statusResult.data.attempt_id)
          }
          setResult({
            correct_count: statusResult.data.correct_count,
            total_questions: statusResult.data.total_questions,
            percentage: statusResult.data.percentage,
          })
        } else if (statusResult.data.attempt_status === 'in_progress') {
          setAssessmentLock(firearmId, true, classId)
        }
      }

      setLoading(false)
    }

    void loadAssessment()
    return () => { active = false }
  }, [classId, firearmId])

  const currentQuestion = questions[currentIndex] ?? null
  const canSubmit = useMemo(
    () => allQuestionsAnswered(questions, answers),
    [answers, questions],
  )

  useEffect(() => {
    if (!attemptId || !currentQuestion || result || submitting) return undefined
    handledTimeoutRef.current = ''
    questionDeadlineRef.current = createQuestionDeadline(Date.now(), QUESTION_TIME_SECONDS)
    // Resetting here synchronizes the countdown with the newly displayed question.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeRemaining(QUESTION_TIME_SECONDS)
    const updateCountdown = () => {
      setTimeRemaining(secondsUntilDeadline(questionDeadlineRef.current, Date.now()))
    }
    const timer = window.setInterval(updateCountdown, 250)
    document.addEventListener('visibilitychange', updateCountdown)
    window.addEventListener('focus', updateCountdown)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateCountdown)
      window.removeEventListener('focus', updateCountdown)
    }
  }, [attemptId, currentQuestion, result, submitting])

  useEffect(() => {
    if (timeRemaining !== 0 || !currentQuestion || submitting || result) return
    const timeoutKey = `${attemptId}:${currentQuestion.question_record_id}`
    if (handledTimeoutRef.current === timeoutKey) return
    handledTimeoutRef.current = timeoutKey

    const nextAnswers = isAnswered(answers[currentQuestion.question_record_id])
      ? answers
      : { ...answers, [currentQuestion.question_record_id]: TIMED_OUT_ANSWER }
    setAnswers(nextAnswers)
    void saveAnswer(currentQuestion, nextAnswers[currentQuestion.question_record_id])

    // A timeout is the assessment event that advances the active question.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1)
    else void submitAssessment(nextAnswers)
    // The submission function consumes the same state already listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, attemptId, currentIndex, currentQuestion, questions.length, result, submitting, timeRemaining])

  useEffect(() => {
    if (!attemptId || result) return undefined
    const poll = window.setInterval(async () => {
      const { data } = await supabase.rpc('get_assessment_status', {
        target_class_id: classId,
        target_firearm_id: firearmId,
      })
      if (data?.attempt_status !== 'submitted') return
      removeStoredDraft(attemptId)
      setAssessmentLock(firearmId, false, classId)
      setResult({
        correct_count: data.correct_count,
        total_questions: data.total_questions,
        percentage: data.percentage,
      })
    }, 4000)
    return () => window.clearInterval(poll)
  }, [attemptId, classId, firearmId, result])

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
    } else if (!data?.length) {
      setError('No assessment questions are available for this firearm.')
    } else {
      const { data: refreshedStatus, error: statusError } = await supabase.rpc(
        'get_assessment_status',
        { target_class_id: classId, target_firearm_id: firearmId },
      )
      const revision = statusError ? null : refreshedStatus.attempt_started_at
      const draft = revision
        ? restoreAssessmentDraft(
            readStoredDraft(data[0].attempt_id),
            { attemptStartedAt: revision, questions: data },
          )
        : { answers: {}, currentIndex: 0 }

      setQuestions(data)
      setAssessmentLock(firearmId, true, classId)
      setAttemptId(data[0].attempt_id)
      setAttemptStartedAt(revision)
      setActivityRecorded(false)
      setAnswers(draft.answers)
      setCurrentIndex(draft.currentIndex)
      if (!statusError) setStatus(refreshedStatus)
    }

    setStarting(false)
  }

  async function submitAssessment(submittedAnswers = answers) {
    if (!allQuestionsAnswered(questions, submittedAnswers) || !attemptId) return
    setSubmitting(true)
    setError('')

    const { data, error: submitError } = await supabase.rpc('submit_assessment', {
      target_attempt_id: attemptId,
      submitted_answers: buildSubmission(questions, submittedAnswers),
    })

    if (submitError) setError(submitError.message)
    else {
      removeStoredDraft(attemptId)
      setAssessmentLock(firearmId, false, classId)
      setResult(data)
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
    return true
  }

  async function advanceQuestion() {
    if (!currentQuestion || !isAnswered(currentAnswer) || submitting) return
    if (!await saveAnswer(currentQuestion, currentAnswer)) return
    if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1)
    else if (canSubmit) await submitAssessment()
  }

  async function recordAssessmentActivity() {
    if (!attemptId || activityRecorded) return

    const { error: activityError } = await supabase.rpc('record_assessment_activity', {
      target_attempt_id: attemptId,
    })

    if (!activityError) setActivityRecorded(true)
  }

  if (loading) return <main className="page status-page">Loading assessment...</main>

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

  if (result) {
    return (
      <main className="student-assessment-page student-assessment-complete">
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
      </main>
    )
  }

  if (questions.length === 0) {
    const released = status?.is_released
    return (
      <main className="student-assessment-page">
        <div className="student-assessment-back"><Link to="/student">← Back to class</Link></div>
        <section className="student-assessment-intro">
          <header><p className="eyebrow">{classItem?.name || 'Class assessment'}</p><h1>{firearm.name} Component Analysis</h1><span>{firearm.name}</span></header>
          <div className="student-assessment-facts"><div><strong>{status?.question_count || status?.total_questions || '—'}</strong><span>Questions</span></div><div><strong>{QUESTION_TIME_SECONDS}s</strong><span>Time per question</span></div><div><strong>{status?.question_count ? `~${Math.ceil(status.question_count * QUESTION_TIME_SECONDS / 60)} min` : '—'}</strong><span>Estimated total</span></div></div>
          <div className="student-assessment-instructions">
            <h2>Before you begin</h2>
            <p><span>○</span> Each question has a {QUESTION_TIME_SECONDS}-second timer and advances automatically when time expires.</p>
            <p><span>△</span> Review each response before continuing. You cannot return to a previous question.</p>
            <p><span>◇</span> The timer continues if you switch tabs or minimize the browser window.</p>
            <p><span>◇</span> Access to the 3D model viewer is disabled during an active attempt.</p>
            <p><span>✓</span> Your progress is saved automatically after every question.</p>
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
            <button className="student-assessment-primary" type="button" onClick={startAssessment} disabled={!released || starting}>
              {starting
                ? 'Loading questions...'
                : status?.attempt_status === 'in_progress' ? 'Resume Assessment' : 'Begin Assessment'}
            </button>
          </footer>
        </section>
      </main>
    )
  }

  const currentAnswer = answers[currentQuestion.question_record_id] ?? ''

  return (
    <main className="student-assessment-page student-assessment-active">
      <div className="student-assessment-progress"><div><span>Question {currentIndex + 1} of {questions.length}</span><strong>{firearm.name}</strong></div><progress value={currentIndex + 1} max={questions.length} /></div>
      <section className="student-question-card">
        <header><p>Question {currentIndex + 1}</p><span className={timeRemaining <= 5 ? 'ending' : ''} aria-label={`${timeRemaining} seconds remaining`}>{timeRemaining}</span></header>
        <div className="student-question-body">
          <div className="student-question-model"><span>{firearm.name}</span><div><i /> <p>Component highlighted in 3D model</p></div></div>
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
