import { useCallback, useEffect, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import FirearmImportPanel from './import/FirearmImportPanel.jsx'
import FirearmLayoutPanel from './import/FirearmLayoutPanel.jsx'
import AccountManagementPanel from './accounts/AccountManagementPanel.jsx'
import AdminAnalyticsPanel from './analytics/AdminAnalyticsPanel.jsx'
import { isFirearmDeleteConfirmed } from './firearm-utils.js'

async function getFunctionErrorMessage(error) {
  try {
    const payload = await error.context?.json()
    return payload?.error || error.message
  } catch {
    return error.message
  }
}

export default function AdminDashboard() {
  const [firearms, setFirearms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0)

  const loadFirearms = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('firearms')
      .select('id, identifier, name, caliber, status, created_at')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
    } else {
      setFirearms(data)
      setError('')
    }

    setLoading(false)
  }, [])

  const refreshFirearms = useCallback(async () => {
    await loadFirearms()
    setAnalyticsRefreshKey((key) => key + 1)
  }, [loadFirearms])

  async function deleteFirearm(firearm) {
    const confirmation = window.prompt(
      `Permanently delete ${firearm.name}? This removes its components, questions, assessment releases, attempts, and scores. Type ${firearm.identifier} to confirm.`,
    )
    if (!isFirearmDeleteConfirmed(firearm.identifier, confirmation)) {
      if (confirmation !== null) setActionError('The identifier did not match. Firearm deletion was cancelled.')
      return
    }

    setDeletingId(firearm.id)
    setActionError('')
    setNotice('')
    const { data, error: functionError } = await supabase.functions.invoke('admin-firearms', {
      body: { action: 'delete_firearm', firearm_id: firearm.id },
    })

    if (functionError) {
      setActionError(await getFunctionErrorMessage(functionError))
    } else {
      setNotice(
        data.storage_warning
          ? `${firearm.name} was deleted. ${data.storage_warning}`
          : `${firearm.name} was permanently deleted. You may now import its corrected replacement bundle.`,
      )
      await refreshFirearms()
    }
    setDeletingId(null)
  }

  useEffect(() => {
    // The loader begins with an awaited Supabase request; state changes occur after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirearms()
  }, [loadFirearms])

  return (
    <RoleDashboard
      title="Admin dashboard"
      description="Manage Trigger3D accounts, firearm content, and system-wide reporting."
    >
      <AdminAnalyticsPanel refreshKey={analyticsRefreshKey} />
      <AccountManagementPanel />

      <article className="dashboard-card dashboard-card-wide">
        <h2>Imported firearms</h2>
        <p>To replace a model or question set, delete its current bundle and import the corrected bundle below.</p>
        {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {loading ? (
          <p>Loading firearm models...</p>
        ) : error ? (
          <div className="alert alert-error" role="alert">{error}</div>
        ) : firearms.length === 0 ? (
          <p>No firearm models imported yet.</p>
        ) : (
          <div className="model-list">
            {firearms.map((firearm) => (
              <div className="model-row" key={firearm.id}>
                <div>
                  <strong>{firearm.name}</strong>
                  <span>{firearm.identifier} · {firearm.caliber}</span>
                </div>
                <div className="model-row-actions">
                  <span className="status-badge active">{firearm.status}</span>
                  <button
                    className="danger-action"
                    disabled={deletingId !== null}
                    onClick={() => deleteFirearm(firearm)}
                    type="button"
                  >
                    {deletingId === firearm.id ? 'Deleting...' : 'Delete bundle'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <FirearmImportPanel onImported={refreshFirearms} />
      <FirearmLayoutPanel firearms={firearms} />
    </RoleDashboard>
  )
}
