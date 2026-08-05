import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  aggregateQuestionResults,
  createAssessmentResultsCsv,
  groupAssessmentResults,
} from './results-utils.js'

export default function FacultyResultsPanel({ selectedClass }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [resettingId, setResettingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const attempts = useMemo(() => groupAssessmentResults(rows), [rows])
  const questionAnalytics = useMemo(() => aggregateQuestionResults(rows), [rows])

  const loadResults = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    setError('')

    const { data, error: resultError } = await supabase.rpc(
      'get_class_assessment_results',
      { target_class_id: selectedClass.id },
    )

    if (resultError) setError(resultError.message)
    else setRows(data)

    setLoading(false)
  }, [selectedClass])

  async function resetAttempt(attempt) {
    const confirmed = window.confirm(
      `Reset ${attempt.student_name}'s ${attempt.firearm_name} attempt? `
      + 'Their saved score and answers will be removed so they can retake it.',
    )
    if (!confirmed) return

    setResettingId(attempt.attempt_id)
    setError('')
    setNotice('')

    const { error: resetError } = await supabase.rpc(
      'reset_student_assessment_attempt',
      { target_attempt_id: attempt.attempt_id },
    )

    if (resetError) {
      setError(resetError.message)
    } else {
      setNotice(
        `${attempt.student_name}'s ${attempt.firearm_name} attempt was reset. `
        + 'Keep the assessment open when they are ready to retake it.',
      )
      await loadResults()
    }

    setResettingId('')
  }

  useEffect(() => {
    if (selectedClass) {
      // Data changes occur after the awaited Supabase request resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadResults()
    }
  }, [loadResults, selectedClass])

  function downloadCsv() {
    const blob = new Blob([createAssessmentResultsCsv(rows)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const classIdentifier = (selectedClass.code || selectedClass.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    link.href = url
    link.download = `${classIdentifier}_assessment_results.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <article className="dashboard-card dashboard-card-wide faculty-results">
      <div className="results-heading">
        <div>
          <h2>Assessment results</h2>
          <p>{selectedClass
            ? `Submitted attempts for ${selectedClass.name}.`
            : 'Select a class to view submitted attempts.'}</p>
        </div>
        {selectedClass && (
          <div className="results-actions">
            <button type="button" onClick={loadResults} disabled={loading}>
              Refresh
            </button>
            <button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
              Download CSV
            </button>
          </div>
        )}
      </div>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {!selectedClass ? null : loading ? (
        <p>Loading results...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : attempts.length === 0 ? (
        <p>No submitted assessments for this class yet.</p>
      ) : (
        <>
          <section className="question-analytics" aria-label="Per-question analytics">
            <div className="question-analytics-heading">
              <h3>Per-question analytics</h3>
              <p>Correct and incorrect responses across submitted attempts.</p>
            </div>
            {questionAnalytics.map((firearm) => (
              <div className="question-analytics-firearm" key={firearm.firearm_id || firearm.firearm_name}>
                <h4>{firearm.firearm_name} <span>{firearm.firearm_caliber}</span></h4>
                <div className="question-analytics-list">
                  {firearm.questions.map((question) => (
                    <div className="question-analytics-row" key={question.question_id}>
                      <div>
                        <strong>{question.question_id}: {question.prompt}</strong>
                        <span>{question.component_name.replaceAll('_', ' ')}</span>
                      </div>
                      <div className="question-accuracy">
                        <div className="question-accuracy-label">
                          <span>{question.correct_count} correct</span>
                          <span>{question.incorrect_count} incorrect</span>
                          <strong>{question.accuracy.toFixed(1)}%</strong>
                        </div>
                        <div
                          aria-label={`${question.accuracy.toFixed(1)} percent correct`}
                          className="question-accuracy-track"
                          role="img"
                        >
                          <div style={{ width: `${question.accuracy}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <div className="faculty-result-list">
            {attempts.map((attempt) => (
            <details className="faculty-result" key={attempt.attempt_id}>
              <summary>
                <div>
                  <strong>{attempt.student_name}</strong>
                  <span>{attempt.student_email}</span>
                </div>
                <div>
                  <strong>{attempt.firearm_name}</strong>
                  <span>{new Date(attempt.submitted_at).toLocaleString()}</span>
                </div>
                <strong className="faculty-result-score">
                  {Number(attempt.percentage).toFixed(2)}%
                </strong>
              </summary>

              <div className="result-question-list">
                {attempt.questions.map((question) => (
                  <div className="result-question" key={question.question_id}>
                    <span className={`status-badge ${question.is_correct ? 'active' : 'removed'}`}>
                      {question.is_correct ? 'correct' : 'incorrect'}
                    </span>
                    <div>
                      <strong>{question.question_id}: {question.prompt}</strong>
                      <span>
                        Answer: {question.student_answer} · Component: {question.component_name.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="result-reset-row">
                <button
                  type="button"
                  onClick={() => resetAttempt(attempt)}
                  disabled={resettingId === attempt.attempt_id}
                >
                  {resettingId === attempt.attempt_id
                    ? 'Resetting...' : 'Reset attempt for retake'}
                </button>
              </div>
            </details>
            ))}
          </div>
        </>
      )}
    </article>
  )
}
