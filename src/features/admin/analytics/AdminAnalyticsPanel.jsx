import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { summarizePerformance } from './analytics-utils.js'

const emptyAnalytics = {
  facultyCount: 0,
  enrolledStudentCount: 0,
  firearmCount: 0,
  performance: summarizePerformance([]),
}

export default function AdminAnalyticsPanel({ refreshKey = 0 }) {
  const [analytics, setAnalytics] = useState(emptyAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    const [facultyResult, enrollmentResult, firearmResult, attemptResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'faculty')
        .is('disabled_at', null),
      supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('firearms')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('assessment_attempts')
        .select('percentage')
        .eq('status', 'submitted'),
    ])

    const queryError = facultyResult.error
      || enrollmentResult.error
      || firearmResult.error
      || attemptResult.error

    if (queryError) {
      setError(queryError.message)
    } else {
      setAnalytics({
        facultyCount: facultyResult.count ?? 0,
        enrolledStudentCount: enrollmentResult.count ?? 0,
        firearmCount: firearmResult.count ?? 0,
        performance: summarizePerformance(
          (attemptResult.data ?? []).map((attempt) => attempt.percentage),
        ),
      })
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // State changes happen after the Supabase requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalytics()
  }, [loadAnalytics, refreshKey])

  const largestBand = Math.max(
    1,
    ...analytics.performance.bands.map((band) => band.count),
  )

  return (
    <article className="dashboard-card admin-analytics-panel">
      <div className="analytics-heading">
        <div>
          <h2>System overview</h2>
          <p>Live access, content, enrollment, and assessment totals.</p>
        </div>
        <button disabled={loading} onClick={loadAnalytics} type="button">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : (
        <>
          <div className="analytics-metrics" aria-busy={loading}>
            <div><strong>{analytics.facultyCount}</strong><span>Faculty with access</span></div>
            <div><strong>{analytics.enrolledStudentCount}</strong><span>Enrolled Students</span></div>
            <div><strong>{analytics.firearmCount}</strong><span>Firearms uploaded</span></div>
            <div>
              <strong>{analytics.performance.average === null ? '—' : `${analytics.performance.average.toFixed(1)}%`}</strong>
              <span>Average assessment score</span>
            </div>
          </div>

          <div className="performance-summary">
            <div>
              <h3>Overall Student performance</h3>
              <p>{analytics.performance.total} completed assessment{analytics.performance.total === 1 ? '' : 's'}</p>
            </div>
            {analytics.performance.total === 0 ? (
              <p>No submitted assessment results yet.</p>
            ) : (
              <div className="performance-bars" aria-label="Assessment score distribution">
                {analytics.performance.bands.map((band) => (
                  <div className="performance-row" key={band.label}>
                    <span>{band.label}</span>
                    <div className="performance-track">
                      <div style={{ width: `${(band.count / largestBand) * 100}%` }} />
                    </div>
                    <strong>{band.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}
