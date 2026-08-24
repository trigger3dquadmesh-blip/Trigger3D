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
import { getSavedDashboardPage, saveDashboardPage } from '../../components/dashboard-location.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

const adminPages = ['overview', 'accounts', 'firearms', 'imports', 'layout']
const adminDashboardPageKey = 'trigger3d.admin.active-page'

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
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, adminDashboardPageKey, adminPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [firearms, setFirearms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0)

  useAutoDismissNotice(notice, () => setNotice(''))

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

  function openDeleteDialog(firearm) {
    setDeleteTarget(firearm)
    setDeleteConfirmation('')
    setActionError('')
  }

  function closeDeleteDialog() {
    if (deletingId) return
    setDeleteTarget(null)
    setDeleteConfirmation('')
  }

  async function deleteFirearm() {
    if (!deleteTarget || !isFirearmDeleteConfirmed(deleteTarget.identifier, deleteConfirmation)) return
    const firearm = deleteTarget

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
      setDeleteTarget(null)
      setDeleteConfirmation('')
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
    saveDashboardPage(localStorage, adminDashboardPageKey, section)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <RoleDashboard
      title="Welcome back"
      description="Manage Trigger3D accounts, firearm content, and system-wide reporting."
      hideUser
      sidebar={<AdminSidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings sidebar />} />}
    >
      {activePage === 'overview' && <section className="admin-dashboard-section"><article className="dashboard-card dashboard-card-wide admin-welcome"><p className="eyebrow">Administrator workspace</p><h2>Everything you need, in one place.</h2><p>Review learning activity, manage accounts, and maintain 3D firearm content from the sidebar.</p></article><AdminAnalyticsPanel refreshKey={analyticsRefreshKey} /></section>}
      {activePage === 'accounts' && <section className="admin-dashboard-section"><AccountManagementPanel /></section>}

      {activePage === 'firearms' && <article className="dashboard-card dashboard-card-wide">
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
                    onClick={() => openDeleteDialog(firearm)}
                    type="button"
                  >
                    {deletingId === firearm.id ? 'Deleting...' : 'Delete bundle'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>}

      {activePage === 'imports' && <section className="admin-dashboard-section"><FirearmImportPanel onImported={refreshFirearms} /></section>}
      {activePage === 'layout' && <section className="admin-dashboard-section"><FirearmLayoutPanel firearms={firearms} /></section>}

      {deleteTarget && (
        <div className="confirmation-backdrop" role="presentation">
          <section aria-labelledby="delete-firearm-title" aria-modal="true" className="confirmation-dialog" role="dialog">
            <p className="eyebrow">Confirm action</p>
            <h2 id="delete-firearm-title">Delete firearm bundle?</h2>
            <p>
              This will permanently remove <strong>{deleteTarget.name}</strong>, its components,
              questions, assessment attempts, and scores. Type <strong>{deleteTarget.identifier}</strong> to continue.
            </p>
            <label>
              Firearm identifier
              <input autoComplete="off" onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteTarget.identifier} value={deleteConfirmation} />
            </label>
            {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
            <div className="confirmation-actions">
              <button className="danger-action" disabled={deletingId !== null || !isFirearmDeleteConfirmed(deleteTarget.identifier, deleteConfirmation)} onClick={deleteFirearm} type="button">{deletingId ? 'Deleting...' : 'Delete permanently'}</button>
              <button disabled={deletingId !== null} onClick={closeDeleteDialog} type="button">Cancel</button>
            </div>
          </section>
        </div>
      )}
    </RoleDashboard>
  )
}
