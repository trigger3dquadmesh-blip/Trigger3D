import { useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import { getSavedDashboardPage } from '../../components/dashboard-location.js'
import useResponsiveSidebar from '../../components/useResponsiveSidebar.js'
import useDashboardTransition from '../../components/useDashboardTransition.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import AdminAccountsPanel from './AdminAccountsPanel.jsx'
import AdminAcademicTermsPanel from './AdminAcademicTermsPanel.jsx'
import AdminAuditLogPanel from './AdminAuditLogPanel.jsx'
import AdminFirearmsPanel from './AdminFirearmsPanel.jsx'
import AdminModelViewerPanel from './AdminModelViewerPanel.jsx'
import AdminOverviewPanel from './AdminOverviewPanel.jsx'
import AdminSettings from './AdminSettings.jsx'
import AdminSidebar from './AdminSidebar.jsx'
import useAdminLiveData from './useAdminLiveData.js'

const adminPages = ['overview', 'terms', 'accounts', 'firearms', 'viewer', 'audit']
const adminDashboardPageKey = 'trigger3d.admin.active-page'
const adminLoadingLabels = { overview: 'Loading dashboard…', terms: 'Loading academic terms…', accounts: 'Loading accounts…', firearms: 'Loading firearms…', viewer: 'Loading firearm viewer…', audit: 'Loading audit log…' }

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState(() => (
    getSavedDashboardPage(localStorage, adminDashboardPageKey, adminPages, 'overview')
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useResponsiveSidebar()
  const [viewerFirearmId, setViewerFirearmId] = useState('')
  const { data, error, loading, reload } = useAdminLiveData()
  const { navigate: transitionTo, pendingPage } = useDashboardTransition(activePage, setActivePage, adminDashboardPageKey)

  function navigateSection(section) {
    transitionTo(section)
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
      sidebar={<AdminSidebar activePage={pendingPage || activePage} collapsed={sidebarCollapsed} onNavigate={navigateSection} onToggle={() => setSidebarCollapsed((value) => !value)} settings={<AdminSettings profileMenu sidebar />} />}
      title="Welcome back"
      variant="role-dashboard-redesign admin-reference-shell"
    >
      {pendingPage ? <section className="admin-reference-page"><DashboardLoading label={adminLoadingLabels[pendingPage]} /></section> : <>
      {activePage === 'overview' && <AdminOverviewPanel data={data} error={error} loading={loading} onNavigate={navigateSection} />}
      {activePage === 'terms' && <AdminAcademicTermsPanel />}
      {activePage === 'accounts' && <AdminAccountsPanel accounts={data.profiles} dataError={error} loading={loading} onChanged={reload} />}
      {activePage === 'firearms' && <AdminFirearmsPanel dataError={error} firearms={data.firearms} loading={loading} onChanged={reload} onPreview={previewFirearm} />}
      {activePage === 'viewer' && <AdminModelViewerPanel dataLoading={loading} firearms={data.firearms} initialFirearmId={viewerFirearmId} />}
      {activePage === 'audit' && <AdminAuditLogPanel academicTerms={data.academicTerms} auditEvents={data.auditEvents} classes={data.classes} dataError={error} loading={loading} />}
      </>}
    </RoleDashboard>
  )
}
