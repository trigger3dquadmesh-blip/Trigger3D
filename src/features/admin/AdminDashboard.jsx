import { useCallback, useEffect, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { supabase } from '../../lib/supabase.js'
import FirearmImportPanel from './import/FirearmImportPanel.jsx'
import FirearmLayoutPanel from './import/FirearmLayoutPanel.jsx'
import AccountManagementPanel from './accounts/AccountManagementPanel.jsx'
import AdminAnalyticsPanel from './analytics/AdminAnalyticsPanel.jsx'
import DemoAdminDashboard from './DemoAdminDashboard.jsx'
import AdminSettings from './AdminSettings.jsx'
import AdminSidebar from './AdminSidebar.jsx'
import { isDemoMode } from '../../lib/supabase.js'
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
  if (isDemoMode) return <DemoAdminDashboard />

  return <LiveAdminDashboard />
}

function LiveAdminDashboard() {
  const [activePage, setActivePage] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  function navigateSection(section) {
    setActivePage(section)
    const target = document.getElementById(section)
    const scrollTarget = target?.firstElementChild ?? target
    scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <RoleDashboard
      title="Welcome back"
      description="Manage Trigger3D accounts, firearm content, and system-wide reporting."
      hideUser
      settings={<AdminSettings />}
      sidebar={<AdminSidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} />}
    >
      <section className="admin-dashboard-section" id="overview"><article className="dashboard-card dashboard-card-wide admin-welcome"><p className="eyebrow">Administrator workspace</p><h2>Everything you need, in one place.</h2><p>Review learning activity, manage accounts, and maintain 3D firearm content from the sidebar.</p></article><AdminAnalyticsPanel refreshKey={analyticsRefreshKey} /></section>
      <section className="admin-dashboard-section" id="accounts"><AccountManagementPanel /></section>

      <article className="dashboard-card dashboard-card-wide" id="firearms">
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

      <section className="admin-dashboard-section" id="imports"><FirearmImportPanel onImported={refreshFirearms} /></section>
      <section className="admin-dashboard-section" id="layout"><FirearmLayoutPanel firearms={firearms} /></section>
    </RoleDashboard>
  )
}
