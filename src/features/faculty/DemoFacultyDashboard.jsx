import { useState } from 'react'
import RoleDashboard from '../../components/RoleDashboard.jsx'
import AdminSettings from '../admin/AdminSettings.jsx'
import FacultySidebar from './FacultySidebar.jsx'

const students = [
  ['Arian Jane C. Agdoro', 'ajagdoro836.pbox@parsu.edu.ph', 'active'],
  ['Jeema M. Dometita', 'jmdometita878.pbox@parsu.edu.ph', 'active'],
  ['Stephanie Jane B. Cea', 'sjcea867.pbox@parsu.edu.ph', 'active'],
]

export default function DemoFacultyDashboard() {
  const [activePage, setActivePage] = useState('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const filteredStudents = students.filter(([name, email]) => (
    `${name} ${email}`.toLowerCase().includes(studentSearch.trim().toLowerCase())
  ))

  return (
    <RoleDashboard
      title="Faculty dashboard"
      description="Manage your classes, students, and assessment activity."
      hideUser
      sidebar={<FacultySidebar activePage={activePage} collapsed={collapsed} onNavigate={setActivePage} onToggle={() => setCollapsed((value) => !value)} settings={<AdminSettings roleName="Faculty" sidebar />} />}
    >
      {activePage === 'overview' && <><article className="dashboard-card dashboard-card-wide admin-welcome"><p className="eyebrow">Faculty workspace</p><h2>Your teaching space, organized.</h2><p>Create classes, guide student access, and review assessment activity from one dashboard.</p></article><article className="dashboard-card dashboard-card-wide student-progress-card"><div><h2>Class activity</h2><p>BSIT 4A · Firearm familiarization</p></div><div className="student-progress-metrics"><div><strong>1</strong><span>Active class</span></div><div><strong>3</strong><span>Students enrolled</span></div><div><strong>0</strong><span>Results submitted</span></div></div></article></>}
      {activePage === 'classes' && <article className="dashboard-card dashboard-card-wide"><h2>Your classes</h2><form className="inline-form"><label htmlFor="demo-class-name">Create a class</label><div className="inline-form-row"><input id="demo-class-name" disabled placeholder="Example: CRIM 101 - Section A" /><button disabled type="button">Create class</button></div></form><div className="class-list"><button className="class-item active" type="button"><strong>BSIT 4A · Firearm familiarization</strong><span className="class-item-meta"><code>DEMO-4A</code><em>Active</em></span></button></div><p className="demo-panel-note">Connect Supabase to create and manage live classes.</p></article>}
      {activePage === 'students' && <article className="dashboard-card dashboard-card-wide"><div className="account-panel-heading"><div><h2>BSIT 4A students</h2><p>Enrollment code: <strong>DEMO-4A</strong></p></div><input aria-label="Search enrolled students" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search student name or email" /></div>{filteredStudents.length === 0 ? <p>No enrolled student named &quot;{studentSearch.trim()}&quot; was found.</p> : <div className="student-list">{filteredStudents.map(([name, email, status]) => <div className="student-row" key={email}><div><strong>{name}</strong><span>{email}</span></div><span className={`status-badge ${status}`}>{status}</span><button disabled type="button">Remove</button></div>)}</div>}<p className="demo-panel-note">This list is sample data. Live enrollment records appear after Supabase is connected.</p></article>}
      {activePage === 'assessments' && <article className="dashboard-card dashboard-card-wide"><h2>Assessment release</h2><p>Choose which firearm assessment is available to the selected class.</p><div className="faculty-demo-form"><label>Class<select disabled><option>BSIT 4A · Firearm familiarization</option></select></label><label>Firearm<select disabled><option>Generic M1911 A2 Pattern</option></select></label><button className="primary-action" disabled type="button">Release assessment</button></div><p className="demo-panel-note">Connect Supabase to release and manage live assessments.</p></article>}
      {activePage === 'results' && <article className="dashboard-card dashboard-card-wide"><h2>Assessment results</h2><p>No student results have been submitted yet.</p><p className="demo-panel-note">Submitted student scores and answer details will appear here.</p></article>}
    </RoleDashboard>
  )
}
