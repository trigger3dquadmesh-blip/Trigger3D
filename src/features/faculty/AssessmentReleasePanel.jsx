import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function AssessmentReleasePanel({ attempts = [], onViewAnalytics, selectedClass }) {
  const [firearms, setFirearms] = useState([])
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')

  const releaseByFirearm = useMemo(
    () => new Map(releases.map((release) => [release.firearm_id, release])),
    [releases],
  )

  const loadReleases = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    setError('')

    const [firearmResult, releaseResult] = await Promise.all([
      supabase
        .from('firearms')
        .select('id, name, caliber')
        .eq('status', 'ready')
        .order('created_at'),
      supabase
        .from('assessment_releases')
        .select('firearm_id, is_open, updated_at')
        .eq('class_id', selectedClass.id),
    ])

    if (firearmResult.error || releaseResult.error) {
      setError(firearmResult.error?.message || releaseResult.error.message)
    } else {
      setFirearms(firearmResult.data)
      setReleases(releaseResult.data)
    }

    setLoading(false)
  }, [selectedClass])

  useEffect(() => {
    if (selectedClass) {
      // Data changes occur after the awaited Supabase requests resolve.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadReleases()
    }
  }, [loadReleases, selectedClass])

  async function toggleRelease(firearm) {
    const isOpen = releaseByFirearm.get(firearm.id)?.is_open ?? false
    setUpdatingId(firearm.id)
    setError('')

    const { error: updateError } = await supabase.rpc('set_assessment_release', {
      target_class_id: selectedClass.id,
      target_firearm_id: firearm.id,
      open_state: !isOpen,
    })

    if (updateError) setError(updateError.message)
    else await loadReleases()

    setUpdatingId('')
  }

  return (
    <article className="dashboard-card dashboard-card-wide faculty-assessment-release">
      <div className="faculty-assessment-heading"><div><h2>Assessments</h2><p>Open or close the firearm assessments assigned to this class.</p></div></div>
      {!selectedClass ? (
        <p>Select a class to manage its assessments.</p>
      ) : selectedClass.archived_at ? (
        <div className="alert" role="status">
          Assessment releases are disabled while this class is archived.
        </div>
      ) : loading ? (
        <p>Loading assessments...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : firearms.length === 0 ? (
        <p>No firearm assessments are available.</p>
      ) : (
        <div className="faculty-release-list">
          {firearms.map((firearm) => {
            const isOpen = releaseByFirearm.get(firearm.id)?.is_open ?? false
            const firearmAttempts = attempts.filter((item) => item.class_id === selectedClass.id && item.firearm_id === firearm.id && item.status === 'submitted')
            const average = firearmAttempts.length ? firearmAttempts.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / firearmAttempts.length : 0
            const passing = firearmAttempts.length ? firearmAttempts.filter((item) => Number(item.percentage) >= 75).length / firearmAttempts.length * 100 : 0
            return (
              <section className="faculty-release-card" key={firearm.id}>
                <header><div><h3>{firearm.name} <span className={isOpen ? 'faculty-active-pill' : 'faculty-closed-pill'}>{isOpen ? 'Open' : 'Closed'}</span></h3><p>{firearm.caliber}</p></div><div><button disabled={updatingId === firearm.id} onClick={() => toggleRelease(firearm)} type="button">{updatingId === firearm.id ? 'Saving…' : isOpen ? 'Close Assessment' : 'Open Assessment'}</button>{onViewAnalytics && <button onClick={onViewAnalytics} type="button">View Results</button>}</div></header>
                <dl><div><dt>Attempts</dt><dd>{firearmAttempts.length}</dd></div><div><dt>Avg Score</dt><dd>{average.toFixed(1)}%</dd></div><div><dt>Pass Rate</dt><dd>{Math.round(passing)}%</dd></div><div><dt>Status</dt><dd>{isOpen ? 'Accepting submissions' : 'Not accepting submissions'}</dd></div></dl>
              </section>
            )
          })}
        </div>
      )}
    </article>
  )
}
