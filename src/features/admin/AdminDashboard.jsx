import { useEffect, useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { getSavedDashboardPage, saveDashboardPage } from '../../components/dashboard-location.js'
import AdminAccountsPanel from './AdminAccountsPanel.jsx'
import AdminAuditLogPanel from './AdminAuditLogPanel.jsx'
import AdminFirearmsPanel from './AdminFirearmsPanel.jsx'
import AdminModelViewerPanel from './AdminModelViewerPanel.jsx'
import AdminOverviewPanel from './AdminOverviewPanel.jsx'
import AdminSettings from './AdminSettings.jsx'
import AdminSidebar from './AdminSidebar.jsx'
import useAdminLiveData from './useAdminLiveData.js'

const adminPages = ['overview', 'accounts', 'firearms', 'viewer', 'audit']
const adminDashboardPageKey = 'trigger3d.admin.active-page'

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, adminDashboardPageKey, adminPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [viewerFirearmId, setViewerFirearmId] = useState('')
  const { data, error, loading, reload } = useAdminLiveData()

  useEffect(() => {
    const phoneLayout = window.matchMedia('(max-width: 760px)')
    const updateSidebar = (event) => setSidebarCollapsed(event.matches)
    phoneLayout.addEventListener('change', updateSidebar)
    return () => phoneLayout.removeEventListener('change', updateSidebar)
  }, [])

  function navigateSection(section) {
    setActivePage(section)
    saveDashboardPage(localStorage, adminDashboardPageKey, section)
    if (window.matchMedia('(max-width: 760px)').matches) setSidebarCollapsed(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function previewFirearm(firearmId) {
    setViewerFirearmId(firearmId)
    navigateSection('viewer')
  }

  return (
    <RoleDashboard
      description="Manage Trigger3D accounts, firearm content, and system-wide reporting."
      hideHeader
      hideUser
      sidebar={<AdminSidebar activePage={activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings profileMenu sidebar />} />}
      title="Welcome back"
      variant="role-dashboard-redesign admin-reference-shell"
    >
      {activePage === 'overview' && <AdminOverviewPanel data={data} error={error} loading={loading} onNavigate={navigateSection} />}
      {activePage === 'accounts' && <AdminAccountsPanel accounts={data.profiles} dataError={error} loading={loading} onChanged={reload} />}
      {activePage === 'firearms' && <AdminFirearmsPanel dataError={error} firearms={data.firearms} loading={loading} onChanged={reload} onPreview={previewFirearm} />}
      {activePage === 'viewer' && <AdminModelViewerPanel firearms={data.firearms} initialFirearmId={viewerFirearmId} />}
      {activePage === 'audit' && <AdminAuditLogPanel auditEvents={data.auditEvents} dataError={error} />}
    </RoleDashboard>
  )
}
