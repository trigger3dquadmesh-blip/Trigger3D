import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useResponsiveSidebar from '../../components/useResponsiveSidebar.js'
import AdminSettings from '../admin/AdminSettings.jsx'
import { assessmentNavigationLockEvent } from './assessment/assessment-lock.js'
import StudentSidebar from './StudentSidebar.jsx'

export default function StudentRouteShell({ children }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useResponsiveSidebar()
  const [assessmentActive, setAssessmentActive] = useState(false)

  useEffect(() => {
    const handleAssessmentNavigationLock = (event) => {
      setAssessmentActive(Boolean(event.detail))
    }
    window.addEventListener(assessmentNavigationLockEvent, handleAssessmentNavigationLock)
    return () => window.removeEventListener(assessmentNavigationLockEvent, handleAssessmentNavigationLock)
  }, [])

  function navigateSection(section) {
    localStorage.setItem('trigger3d.student.active-page', section)
    navigate('/student')
  }
  function handleContentClick(event) {
    if (collapsed || !window.matchMedia('(max-width: 1024px)').matches) return
    const interactive = event.target.closest('a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])')
    if (!interactive) setCollapsed(true)
  }
  return <div className={`admin-shell role-dashboard-redesign admin-reference-shell student-reference-shell student-route-shell${collapsed ? ' sidebar-collapsed' : ''}${assessmentActive ? ' assessment-route-active' : ''}`}><StudentSidebar activePage="class" collapsed={collapsed} interactionLocked={assessmentActive} onNavigate={navigateSection} onToggle={() => setCollapsed((value) => !value)} settings={<AdminSettings interactionLocked={assessmentActive} profileMenu roleName="Student" sidebar />} /><div className="student-route-content" onClick={handleContentClick}>{children}</div></div>
}
