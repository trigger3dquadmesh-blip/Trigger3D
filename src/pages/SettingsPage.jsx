import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import RoleDashboard from '../components/RoleDashboard.jsx'
import { getRoleHomePath, ROLES } from '../config/roles.js'
import AdminSettings from '../features/admin/AdminSettings.jsx'
import AdminSidebar from '../features/admin/AdminSidebar.jsx'
import FacultySidebar from '../features/faculty/FacultySidebar.jsx'
import StudentSidebar from '../features/student/StudentSidebar.jsx'
import { saveDashboardPage } from '../components/dashboard-location.js'
import useResponsiveSidebar from '../components/useResponsiveSidebar.js'
import DashboardLoading from '../components/DashboardLoading.jsx'

const roleDetails = {
  [ROLES.ADMIN]: { roleName: 'Administrator', title: 'Account settings', pageKey: 'trigger3d.admin.active-page' },
  [ROLES.FACULTY]: { roleName: 'Faculty', title: 'Account settings', pageKey: 'trigger3d.faculty.active-page' },
  [ROLES.STUDENT]: { roleName: 'Student', title: 'Account settings', pageKey: 'trigger3d.student.active-page' },
}

const dashboardLoadingLabels = {
  overview: 'Loading dashboard…',
  accounts: 'Loading accounts…',
  firearms: 'Loading firearms…',
  viewer: 'Loading firearm viewer…',
  audit: 'Loading audit log…',
  classes: 'Loading classes…',
  class: 'Loading class…',
  students: 'Loading students…',
  assessments: 'Loading assessments…',
  results: 'Loading results…',
}

export default function SettingsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useResponsiveSidebar()
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [pendingPage, setPendingPage] = useState('')
  const transitionTimer = useRef(null)
  const details = roleDetails[role]

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setLoadingSettings(false), 300)
    return () => {
      window.clearTimeout(loadingTimer)
      window.clearTimeout(transitionTimer.current)
    }
  }, [])

  if (!details) return null

  const sidebarProps = {
    activePage: pendingPage,
    collapsed: sidebarCollapsed,
    onNavigate: (page) => {
      window.clearTimeout(transitionTimer.current)
      setPendingPage(page)
      saveDashboardPage(localStorage, details.pageKey, page)
      transitionTimer.current = window.setTimeout(() => navigate(getRoleHomePath(role)), 300)
    },
    onToggle: () => setSidebarCollapsed((value) => !value),
    settings: <AdminSettings active profileMenu roleName={details.roleName} sidebar />,
  }

  const sidebar = role === ROLES.ADMIN
    ? <AdminSidebar {...sidebarProps} />
    : role === ROLES.FACULTY
      ? <FacultySidebar {...sidebarProps} />
      : <StudentSidebar {...sidebarProps} />

  return (
    <RoleDashboard
      description="Manage your name, email address, password, and sign-in preferences."
      hideHeader
      hideUser
      sidebar={sidebar}
      title={details.title}
      variant="role-dashboard-redesign admin-reference-shell admin-settings-shell"
    >
      {pendingPage
        ? <section className="admin-reference-page"><DashboardLoading label={dashboardLoadingLabels[pendingPage] || 'Loading…'} /></section>
        : loadingSettings
          ? <section className="admin-reference-page"><DashboardLoading label="Loading account settings…" /></section>
          : <AdminSettings page roleName={details.roleName} />}
    </RoleDashboard>
  )
}
