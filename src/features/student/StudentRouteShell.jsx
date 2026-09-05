import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSettings from '../admin/AdminSettings.jsx'
import StudentSidebar from './StudentSidebar.jsx'

export default function StudentRouteShell({ children }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  function navigateSection(section) {
    localStorage.setItem('trigger3d.student.active-page', section)
    navigate('/student')
  }
  return <div className={`admin-shell role-dashboard-redesign admin-reference-shell student-reference-shell student-route-shell${collapsed ? ' sidebar-collapsed' : ''}`}><StudentSidebar activePage="class" collapsed={collapsed} onNavigate={navigateSection} onToggle={() => setCollapsed((value) => !value)} settings={<AdminSettings profileMenu roleName="Student" sidebar />} /><div className="student-route-content">{children}</div></div>
}
