import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase.js'
import { allQuestionsAnswered, buildSubmission, isAnswered } from './assessment-utils.js'
import {
  createAssessmentDraft,
  getAssessmentDraftKey,
  restoreAssessmentDraft,
} from './assessment-draft.js'
import { setAssessmentLock } from './assessment-lock.js'

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
  const [firearm, setFirearm] = useState(null)
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
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadAssessment() {
      const [firearmResult, statusResult] = await Promise.all([
        supabase
          .from('firearms')
          .select('id, name, caliber')
          .eq('id', firearmId)
          .single(),
        supabase.rpc('get_assessment_status', { target_firearm_id: firearmId }),
      ])

      if (!active) return

      if (firearmResult.error || statusResult.error) {
        setError(firearmResult.error?.message || statusResult.error.message)
      } else {
        setFirearm(firearmResult.data)
        setStatus(statusResult.data)
        if (statusResult.data.attempt_status === 'submitted') {
          setAssessmentLock(firearmId, false)
          if (statusResult.data.attempt_id) {
            removeStoredDraft(statusResult.data.attempt_id)
          }
          setResult({
            correct_count: statusResult.data.correct_count,
            total_questions: statusResult.data.total_questions,
            percentage: statusResult.data.percentage,
          })
        } else if (statusResult.data.attempt_status === 'in_progress') {
          setAssessmentLock(firearmId, true)
        }
      }

      setLoading(false)
    }

    void loadAssessment()
    return () => { active = false }
  }, [firearmId])

  const currentQuestion = questions[currentIndex] ?? null
  const canSubmit = useMemo(
    () => allQuestionsAnswered(questions, answers),
    [answers, questions],
  )

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
      target_firearm_id: firearmId,
    })

    if (startError) {
      setError(startError.message)
    } else if (!data?.length) {
      setError('No assessment questions are available for this firearm.')
    } else {
      const { data: refreshedStatus, error: statusError } = await supabase.rpc(
        'get_assessment_status',
        { target_firearm_id: firearmId },
      )
      const revision = statusError ? null : refreshedStatus.attempt_started_at
      const draft = revision
        ? restoreAssessmentDraft(
            readStoredDraft(data[0].attempt_id),
            { attemptStartedAt: revision, questions: data },
          )
        : { answers: {}, currentIndex: 0 }

      setQuestions(data)
      setAssessmentLock(firearmId, true)
      setAttemptId(data[0].attempt_id)
      setAttemptStartedAt(revision)
      setActivityRecorded(false)
      setAnswers(draft.answers)
      setCurrentIndex(draft.currentIndex)
      if (!statusError) setStatus(refreshedStatus)
    }

    setStarting(false)
  }

  async function submitAssessment() {
    if (!canSubmit || !attemptId) return
    setSubmitting(true)
    setError('')

    const { data, error: submitError } = await supabase.rpc('submit_assessment', {
      target_attempt_id: attemptId,
      submitted_answers: buildSubmission(questions, answers),
    })

    if (submitError) setError(submitError.message)
    else {
      removeStoredDraft(attemptId)
      setAssessmentLock(firearmId, false)
      setResult(data)
    }

    setSubmitting(false)
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
      <main className="page assessment-page">
        <section className="card assessment-result">
          <p className="eyebrow">Assessment complete</p>
          <h1>{firearm.name}</h1>
          <strong className="result-percentage">{Number(result.percentage).toFixed(2)}%</strong>
          <p>{result.correct_count} of {result.total_questions} answers correct</p>
          <p>This firearm allows one assessment attempt.</p>
          <div className="assessment-navigation">
            <Link to={`/student/models/${firearmId}`}>Return to model</Link>
            <Link to="/student">Student dashboard</Link>
          </div>
        </section>
      </main>
    )
  }

  if (questions.length === 0) {
    const released = status?.is_released
    return (
      <main className="page assessment-page">
        <section className="card assessment-intro">
          <p className="eyebrow">Identification assessment</p>
          <h1>{firearm.name}</h1>
          <p>
            The complete firearm question bank appears in randomized order.
            Every question must be answered.
          </p>
          {!released && (
            <div className="alert" role="status">
              This assessment is locked until your Faculty instructor opens it.
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="assessment-navigation">
            <Link to={status?.attempt_status === 'in_progress'
              ? '/student'
              : `/student/models/${firearmId}`}>
              {status?.attempt_status === 'in_progress' ? 'Student dashboard' : 'Return to model'}
            </Link>
            <button type="button" onClick={startAssessment} disabled={!released || starting}>
              {starting
                ? 'Loading questions...'
                : status?.attempt_status === 'in_progress' ? 'Resume attempt' : 'Start assessment'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  const currentAnswer = answers[currentQuestion.question_record_id] ?? ''

  return (
    <main className="page assessment-page">
      <section className="card assessment-card">
        <div className="assessment-progress">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <progress value={currentIndex + 1} max={questions.length} />
        </div>

        <p className="assessment-draft-note">Answers are saved on this device until submission.</p>

        <p className="eyebrow">Identification question</p>
        <h1>{currentQuestion.prompt}</h1>

        {currentQuestion.image_file && (
          <div className="alert">Image question asset: {currentQuestion.image_file}</div>
        )}

        <label className="assessment-answer">
          Your answer
          <input
            value={currentAnswer}
            onChange={(event) => {
              setAnswers((current) => ({
                ...current,
                [currentQuestion.question_record_id]: event.target.value,
              }))
              void recordAssessmentActivity()
            }}
            autoFocus
            autoComplete="off"
            disabled={submitting}
          />
        </label>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="assessment-navigation">
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => index - 1)}
            disabled={currentIndex === 0 || submitting}
          >
            ‹ Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => index + 1)}
              disabled={!isAnswered(currentAnswer) || submitting}
            >
              Next question ›
            </button>
          ) : (
            <button
              className="primary-action"
              type="button"
              onClick={submitAssessment}
              disabled={!canSubmit || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit assessment'}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
