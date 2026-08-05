import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function AssessmentReleasePanel({ selectedClass }) {
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
    <article className="dashboard-card dashboard-card-wide">
      <h2>Assessment release</h2>
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
        <div className="model-list">
          {firearms.map((firearm) => {
            const isOpen = releaseByFirearm.get(firearm.id)?.is_open ?? false
            return (
              <div className="model-row" key={firearm.id}>
                <div>
                  <strong>{firearm.name}</strong>
                  <span>{firearm.caliber}</span>
                </div>
                <span className={`status-badge ${isOpen ? 'active' : 'removed'}`}>
                  {isOpen ? 'open' : 'closed'}
                </span>
                <button
                  type="button"
                  disabled={updatingId === firearm.id}
                  onClick={() => toggleRelease(firearm)}
                >
                  {updatingId === firearm.id
                    ? 'Saving...'
                    : isOpen ? 'Close assessment' : 'Open assessment'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
