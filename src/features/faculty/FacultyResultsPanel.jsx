import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import useAuth from '../../auth/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import {
  aggregateQuestionResults,
  createAssessmentResultsCsv,
  groupAssessmentResults,
} from './results-utils.js'
import {
  buildGradebookData,
  createGradebookWorkbook,
  gradebookFilename,
} from './gradebook-utils.js'
import { getResultsPage } from './results-pagination.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import ProgressGraphAnalytics from './ProgressGraphAnalytics.jsx'
import { assessmentStatusDetails, buildAssessmentActivity } from './assessment-status.js'

function formatAttemptCount(count) {
  if (!count) return 'No attempts'
  return `${count} ${count === 1 ? 'attempt' : 'attempts'}`
}

export default function FacultyResultsPanel({ selectedClass }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(false)
  const [resettingId, setResettingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [analyticsPages, setAnalyticsPages] = useState({})
  const [attemptPages, setAttemptPages] = useState({})
  const [selectedAttemptId, setSelectedAttemptId] = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [resetError, setResetError] = useState('')
  const [gradebookSource, setGradebookSource] = useState(null)
  const [exportFormat, setExportFormat] = useState('')
  const [selectedExportFormat, setSelectedExportFormat] = useState('')
  const [exportError, setExportError] = useState('')

  useAutoDismissNotice(notice, () => setNotice(''))

  const attempts = useMemo(() => groupAssessmentResults(rows), [rows])
  const activityByAttemptId = useMemo(
    () => new Map(activity.filter((item) => item.attempt_id).map((item) => [item.attempt_id, item])),
    [activity],
  )
  const questionAnalytics = useMemo(() => aggregateQuestionResults(rows), [rows])
  const selectedAttempt = attempts.find((attempt) => attempt.attempt_id === selectedAttemptId)
  const selectedQuestionAnalytics = useMemo(() => aggregateQuestionResults(
    rows.filter((row) => row.attempt_id === selectedAttemptId),
  ), [rows, selectedAttemptId])

  const loadResults = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    setError('')
    setExportError('')
    setGradebookSource(null)

    const [resultResponse, enrollmentResponse, releaseResponse, firearmResponse, attemptResponse] = await Promise.all([
      supabase.rpc('get_class_assessment_results', { target_class_id: selectedClass.id }),
      supabase
        .from('enrollments')
        .select('student_id, status, student:profiles!enrollments_student_id_fkey(email, full_name)')
        .eq('class_id', selectedClass.id),
      supabase
        .from('assessment_releases')
        .select('firearm_id, is_open')
        .eq('class_id', selectedClass.id),
      supabase.from('firearms').select('id, name, caliber').eq('status', 'ready'),
      supabase
        .from('assessment_attempts')
        .select('id, student_id, firearm_id, status, percentage, has_activity, attempt_number')
        .eq('class_id', selectedClass.id),
    ])

    const requestError = resultResponse.error
      || enrollmentResponse.error
      || releaseResponse.error
      || firearmResponse.error
      || attemptResponse.error

    if (requestError) setError(requestError.message)
    else {
      const scoreByStudentAndFirearm = new Map()
      ;(resultResponse.data ?? []).forEach((result) => {
        const key = `${result.student_id}:${result.firearm_id}`
        if (!scoreByStudentAndFirearm.has(key)) {
          scoreByStudentAndFirearm.set(key, {
            correctCount: result.correct_count,
            totalQuestions: result.total_questions,
          })
        }
      })

      const gradebookAttempts = (attemptResponse.data ?? []).map((attempt) => ({
        ...attempt,
        ...scoreByStudentAndFirearm.get(`${attempt.student_id}:${attempt.firearm_id}`),
      }))

      setRows(resultResponse.data)
      setGradebookSource({
        attempts: gradebookAttempts,
        enrollments: enrollmentResponse.data,
        firearms: firearmResponse.data,
        releases: releaseResponse.data,
      })
      setActivity(buildAssessmentActivity(
        enrollmentResponse.data,
        releaseResponse.data,
        firearmResponse.data,
        attemptResponse.data,
      ))
    }

    setLoading(false)
  }, [selectedClass])

  function requestReset(attempt) {
    setResetError('')
    setResetTarget(attempt)
  }

  async function resetAttempt() {
    if (!resetTarget) return
    const attempt = resetTarget

    setResettingId(attempt.attempt_id)
    setResetError('')
    setNotice('')

    const { error: requestError } = await supabase.rpc(
      'reset_student_assessment_attempt',
      { target_attempt_id: attempt.attempt_id },
    )

    if (requestError) {
      setResetError(requestError.message)
    } else {
      setNotice(
        `${attempt.student_name}'s ${attempt.firearm_name} attempt was reset. `
        + 'Keep the assessment open when they are ready to retake it.',
      )
      setResetTarget(null)
      setSelectedAttemptId('')
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

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function exportGradebook() {
    if (!gradebookSource || !selectedClass) return
    setExportFormat('xlsx')
    setExportError('')

    try {
      const gradebook = buildGradebookData({
        ...gradebookSource,
        facultyName: profile?.full_name || profile?.email || '',
        selectedClass,
      })
      if (gradebook.students.length === 0) {
        throw new Error('There are no active students enrolled in this class to export.')
      }

      const buffer = await createGradebookWorkbook(gradebook)
      downloadFile(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }), gradebookFilename(selectedClass, 'xlsx'))
      setNotice('Gradebook downloaded as Excel (.xlsx).')
    } catch (requestError) {
      setExportError(requestError.message || 'The gradebook could not be exported.')
    } finally {
      setExportFormat('')
      setSelectedExportFormat('')
    }
  }

  function handleGradebookExportChange(event) {
    const format = event.target.value
    setSelectedExportFormat(format)
    if (format === 'xlsx') void exportGradebook()
    if (format === 'detailed-csv') void downloadDetailedCsv()
  }

  function downloadDetailedCsv() {
    try {
      if (rows.length === 0) {
        throw new Error('There are no submitted answers in this class to export.')
      }

      const blob = new Blob([createAssessmentResultsCsv(rows)], {
        type: 'text/csv;charset=utf-8',
      })
      const classIdentifier = (selectedClass.code || selectedClass.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')

      downloadFile(blob, `${classIdentifier}_detailed_assessment_results.csv`)
      setNotice('Detailed results downloaded as CSV.')
    } catch (requestError) {
      setExportError(requestError.message || 'The detailed results could not be exported.')
    } finally {
      setSelectedExportFormat('')
    }
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
            <div className="gradebook-export">
              <label className="gradebook-export-label" htmlFor="gradebook-export-format">Download results</label>
              <select
                aria-label="Gradebook download format"
                className="gradebook-export-select"
                disabled={loading || Boolean(exportFormat) || !gradebookSource}
                id="gradebook-export-format"
                onChange={handleGradebookExportChange}
                value={selectedExportFormat}
              >
                <option value="">Choose file format</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="detailed-csv">Detailed answers (.csv)</option>
              </select>
            </div>
            <button
              aria-label="Refresh assessment results"
              className={`results-refresh-button${loading ? ' is-refreshing' : ''}`}
              disabled={loading}
              onClick={loadResults}
              title="Refresh results"
              type="button"
            >
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        )}
      </div>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {exportError && <div className="alert alert-error" role="alert">{exportError}</div>}

      {!selectedClass ? null : loading ? (
        <p>Loading results...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : activity.length === 0 ? (
        <p>No assessment activity for this class yet. Open an assessment to show each enrolled student's status.</p>
      ) : (
        <>
          <section className="submitted-attempts" aria-label="Assessment activity">
            <div className="submitted-attempts-heading">
              <h3>Assessment activity</h3>
              <p>Select a submitted student to review their answers.</p>
            </div>
            <div className="submitted-attempts-table" role="table" aria-label="Student assessment activity">
              <div className="submitted-attempts-row submitted-attempts-labels" role="row">
                <span role="columnheader">Student</span>
                <span role="columnheader">Pattern</span>
                <span role="columnheader">Progress</span>
                <span role="columnheader">Score</span>
                <span role="columnheader">Status</span>
              </div>
              {attempts.map((attempt) => (
                <Fragment key={attempt.attempt_id}>
                <button
                  aria-expanded={selectedAttemptId === attempt.attempt_id}
                  className={`submitted-attempts-row ${selectedAttemptId === attempt.attempt_id ? 'selected' : ''}`}
                  onClick={() => setSelectedAttemptId((currentId) => (
                    currentId === attempt.attempt_id ? '' : attempt.attempt_id
                  ))}
                  role="row"
                  type="button"
                >
                  <span role="cell">
                    <strong>{attempt.student_name}</strong>
                    <small>{attempt.student_email}</small>
                  </span>
                  <span role="cell">{attempt.firearm_name}</span>
                  <span role="cell">{formatAttemptCount(activityByAttemptId.get(attempt.attempt_id)?.attempt_count || 1)}</span>
                  <strong className="submitted-attempt-score" role="cell">
                    {Number(attempt.percentage).toFixed(1)}%
                  </strong>
                  <span aria-label="Submitted" className="submitted-attempt-status" role="cell">Submitted</span>
                </button>
                  {selectedAttemptId === attempt.attempt_id && (
                    <div className="submitted-attempt-detail" role="row">
                      <div>
                        <div className="submitted-attempt-detail-heading">
                          <h3>{attempt.student_name}'s record</h3>
                          <button type="button" onClick={() => setSelectedAttemptId('')}>Close</button>
                        </div>
                        <ProgressGraphAnalytics
                          attempts={[attempt]}
                          questionAnalytics={selectedQuestionAnalytics}
                        studentName={attempt.student_name}
                      />
                      <AttemptResult
                        attempt={attempt}
                        onChangePage={(nextPage) => setAttemptPages((pages) => ({
                          ...pages,
                          [attempt.attempt_id]: nextPage,
                        }))}
                        onReset={requestReset}
                        page={attemptPages[attempt.attempt_id] || 0}
                        resetting={resettingId === attempt.attempt_id}
                      />
                    </div>
                  </div>
                )}
                </Fragment>
              ))}
              {activity.filter((item) => item.status !== 'submitted').map((item) => {
                const status = assessmentStatusDetails(item.status)
                return (
                  <div className="submitted-attempts-row submitted-attempts-row-static" key={`${item.student_email}:${item.firearm_name}`} role="row">
                    <span role="cell">
                      <strong>{item.student_name}</strong>
                      <small>{item.student_email}</small>
                    </span>
                    <span role="cell">{item.firearm_name}</span>
                    <span role="cell">{formatAttemptCount(item.attempt_count)}</span>
                    <strong className="submitted-attempt-score submitted-attempt-score-muted" role="cell">
                      {item.percentage == null ? '—' : `${Number(item.percentage).toFixed(1)}%`}
                    </strong>
                    <span className={`submitted-attempt-status ${status.className}`} role="cell">
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {!selectedAttempt && <ProgressGraphAnalytics attempts={attempts} questionAnalytics={questionAnalytics} />}

          {questionAnalytics.length > 0 && <section className="question-analytics" aria-label="Per-question analytics">
            <div className="question-analytics-heading">
              <h3>Per-question analytics</h3>
              <p>Correct and incorrect responses across submitted attempts.</p>
            </div>
            {questionAnalytics.map((firearm) => {
              const firearmKey = firearm.firearm_id || firearm.firearm_name
              return (
                <AnalyticsFirearm
                  firearm={firearm}
                  key={firearmKey}
                  onChangePage={(nextPage) => setAnalyticsPages((pages) => ({
                    ...pages,
                    [firearmKey]: nextPage,
                  }))}
                  page={analyticsPages[firearmKey] || 0}
                />
              )
            })}
          </section>}

        </>
      )}

      {resetTarget && (
        <div className="confirmation-backdrop" role="presentation">
          <section aria-labelledby="reset-attempt-title" aria-modal="true" className="confirmation-dialog" role="dialog">
            <p className="eyebrow">Confirm action</p>
            <h2 id="reset-attempt-title">Reset assessment attempt?</h2>
            <p>
              Reset <strong>{resetTarget.student_name}</strong>'s <strong>{resetTarget.firearm_name}</strong> attempt?
              Their saved score and answers will be removed so they can retake it.
            </p>
            {resetError && <div className="alert alert-error" role="alert">{resetError}</div>}
            <div className="confirmation-actions">
              <button className="danger-action" disabled={Boolean(resettingId)} onClick={resetAttempt} type="button">
                {resettingId ? 'Resetting...' : 'Reset attempt'}
              </button>
              <button disabled={Boolean(resettingId)} onClick={() => setResetTarget(null)} type="button">Cancel</button>
            </div>
          </section>
        </div>
      )}
    </article>
  )
}

function ResultsPagination({ page, pageCount, onChangePage, label }) {
  if (pageCount <= 1) return null

  return (
    <div className="results-pagination" aria-label={label}>
      <button type="button" disabled={page === 0} onClick={() => onChangePage(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pageCount}</span>
      <button type="button" disabled={page === pageCount - 1} onClick={() => onChangePage(page + 1)}>Next</button>
    </div>
  )
}

function AnalyticsFirearm({ firearm, page, onChangePage }) {
  const currentPage = getResultsPage(firearm.questions, page)

  return (
    <div className="question-analytics-firearm">
      <h4>{firearm.firearm_name} <span>{firearm.firearm_caliber}</span></h4>
      <div className="question-analytics-list">
        {currentPage.items.map((question) => (
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
      <ResultsPagination
        label={`${firearm.firearm_name} analytics pages`}
        onChangePage={onChangePage}
        page={currentPage.page}
        pageCount={currentPage.pageCount}
      />
    </div>
  )
}

function AttemptResult({ attempt, page, onChangePage, onReset, resetting }) {
  const currentPage = getResultsPage(attempt.questions, page)

  return (
    <div className="faculty-result">
      <div className="faculty-result-summary">
        <div>
          <strong>{attempt.student_name}</strong>
          <span>{attempt.student_email}</span>
        </div>
        <div>
          <strong>{attempt.firearm_name}</strong>
          <span>{new Date(attempt.submitted_at).toLocaleString()}</span>
        </div>
        <strong className="faculty-result-score">{Number(attempt.percentage).toFixed(2)}%</strong>
      </div>

      <div className="result-question-list">
        {currentPage.items.map((question) => (
          <div className="result-question" key={question.question_id}>
            <span className={`status-badge ${question.is_correct ? 'active' : 'removed'}`}>
              {question.is_correct ? 'correct' : 'incorrect'}
            </span>
            <div>
              <strong>{question.question_id}: {question.prompt}</strong>
              <span>Answer: {question.student_answer} · Component: {question.component_name.replaceAll('_', ' ')}</span>
            </div>
          </div>
        ))}
      </div>
      <ResultsPagination
        label={`${attempt.student_name} answer pages`}
        onChangePage={onChangePage}
        page={currentPage.page}
        pageCount={currentPage.pageCount}
      />
      <div className="result-reset-row">
        <button type="button" onClick={() => onReset(attempt)} disabled={resetting}>
          {resetting ? 'Resetting...' : 'Reset attempt for retake'}
        </button>
      </div>
    </div>
  )
}
