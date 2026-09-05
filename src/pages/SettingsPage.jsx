import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import RoleDashboard from '../components/RoleDashboard.jsx'
import { getRoleHomePath, ROLES } from '../config/roles.js'
import AdminSettings from '../features/admin/AdminSettings.jsx'
import AdminSidebar from '../features/admin/AdminSidebar.jsx'
import FacultySidebar from '../features/faculty/FacultySidebar.jsx'
import StudentSidebar from '../features/student/StudentSidebar.jsx'
import { saveDashboardPage } from '../components/dashboard-location.js'

const roleDetails = {
  [ROLES.ADMIN]: { roleName: 'Administrator', title: 'Account settings', pageKey: 'trigger3d.admin.active-page' },
  [ROLES.FACULTY]: { roleName: 'Faculty', title: 'Account settings', pageKey: 'trigger3d.faculty.active-page' },
  [ROLES.STUDENT]: { roleName: 'Student', title: 'Account settings', pageKey: 'trigger3d.student.active-page' },
}

export default function SettingsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const details = roleDetails[role]

  if (!details) return null

  const sidebarProps = {
    activePage: '',
    collapsed: sidebarCollapsed,
    onNavigate: (page) => {
      saveDashboardPage(localStorage, details.pageKey, page)
      navigate(getRoleHomePath(role))
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
      <AdminSettings page roleName={details.roleName} />
    </RoleDashboard>
  )
}
