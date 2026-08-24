import { useState } from 'react'
import useAuth from '../../auth/useAuth.js'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import AdminSettings from '../admin/AdminSettings.jsx'
import StudentSidebar from './StudentSidebar.jsx'
import { getStudentGreeting } from './student-greeting.js'

export default function DemoStudentDashboard() {
  const { profile } = useAuth()
  const [activePage, setActivePage] = useState('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [greeting] = useState(() => getStudentGreeting(profile, localStorage))

  return (
    <RoleDashboard
      title="Student dashboard"
      description="Keep up with your class, 3D models, and assessment results."
      hideUser
      sidebar={<StudentSidebar activePage={activePage} collapsed={collapsed} onNavigate={setActivePage} onToggle={() => setCollapsed((value) => !value)} settings={<AdminSettings roleName="Student" sidebar />} />}
    >
      {activePage === 'overview' && (
        <>
          <article className="dashboard-card dashboard-card-wide admin-welcome">
            <p className="eyebrow">Student workspace</p>
            <h2>{greeting}</h2>
            <p>Your classes, available models, and assessment progress are all in one place.</p>
          </article>
          <article className="dashboard-card dashboard-card-wide student-progress-card">
            <div><h2>Current progress</h2><p>BSIT 4A · Firearm familiarization</p></div>
            <div className="student-progress-metrics"><div><strong>1</strong><span>Active class</span></div><div><strong>1</strong><span>Available model</span></div><div><strong>—</strong><span>Results submitted</span></div></div>
          </article>
        </>
      )}
      {activePage === 'enrollment' && <article className="dashboard-card dashboard-card-wide"><h2>Class enrollment</h2><div className="enrollment-summary"><span className="status-badge active">active</span><h3>BSIT 4A · Firearm familiarization</h3><p>Class code: <strong>DEMO-4A</strong></p></div><p className="demo-panel-note">This is sample enrollment data. Your faculty member’s class will appear here after Supabase is connected.</p></article>}
      {activePage === 'models' && <article className="dashboard-card dashboard-card-wide"><h2>3D models</h2><p>Models are unlocked while you have an active class enrollment.</p><div className="available-models"><div className="demo-model-card"><strong>Generic M1911 A2 Pattern</strong><span>.45 caliber · Available to explore</span></div></div><p className="demo-panel-note">Connect Supabase to open the live model viewer and assessment.</p></article>}
      {activePage === 'results' && <article className="dashboard-card dashboard-card-wide"><h2>Your results</h2><p>No assessment results yet. Complete an assessment to see your scores here.</p></article>}
    </RoleDashboard>
  )
}
