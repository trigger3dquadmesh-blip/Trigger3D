import { getActiveFacultyDashboardData } from './faculty-dashboard-data.js'

function OverviewIcon({ name }) {
  const paths = {
    classes: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6M7 9h2m6 0h2M7 12h2m6 0h2" /></>,
    students: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20" /><path d="M17 5.5a3 3 0 0 1 0 5.7M18 14.2a3.8 3.8 0 0 1 2.5 3.6V20" /></>,
    completion: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></>,
    firearms: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></>,
    attention: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></>,
  }
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>
}

function studentName(studentId, enrollments) {
  const enrollment = enrollments.find((item) => item.student_id === studentId)
  return enrollment?.student?.full_name || enrollment?.student?.email || 'Student'
}

export default function FacultyOverviewPanel({ attempts, classes, enrollments, firearms, loading, onManageClass, onNavigate, releases }) {
  const { activeClasses, activeClassIds, activeEnrollments, submittedAttempts } = getActiveFacultyDashboardData({ attempts, classes, enrollments })
  const readyFirearms = firearms.filter((item) => item.status === 'ready')
  const assignedReleases = releases.filter((item) => activeClassIds.has(item.class_id))
  const openReleases = releases.filter((item) => item.is_open && activeClassIds.has(item.class_id))

  const expectedCompletions = assignedReleases.reduce((total, release) => (
    total + activeEnrollments.filter((item) => item.class_id === release.class_id).length
  ), 0)
  const submittedKeys = new Set(submittedAttempts.map((item) => `${item.class_id}:${item.student_id}:${item.firearm_id}`))
  const completedAssignments = assignedReleases.reduce((total, release) => (
    total + activeEnrollments.filter((item) => (
      item.class_id === release.class_id
      && submittedKeys.has(`${release.class_id}:${item.student_id}:${release.firearm_id}`)
    )).length
  ), 0)
  const completionRate = expectedCompletions ? Math.round((completedAssignments / expectedCompletions) * 100) : 0

  const attention = openReleases.map((release) => {
    const classItem = classes.find((item) => item.id === release.class_id)
    const firearm = firearms.find((item) => item.id === release.firearm_id)
    const students = activeEnrollments.filter((item) => item.class_id === release.class_id)
    const incomplete = students.filter((item) => !submittedKeys.has(`${release.class_id}:${item.student_id}:${release.firearm_id}`)).length
    return { id: `${release.class_id}:${release.firearm_id}`, count: incomplete, className: classItem?.name || 'Class', firearmName: firearm?.name || 'Firearm assessment' }
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 3)

  const scoreBands = [
    { label: '90–100', minimum: 90, maximum: 100 },
    { label: '80–89', minimum: 80, maximum: 89.999 },
    { label: '70–79', minimum: 70, maximum: 79.999 },
    { label: '60–69', minimum: 60, maximum: 69.999 },
    { label: 'Below 60', minimum: 0, maximum: 59.999 },
  ].map((band) => ({ ...band, value: submittedAttempts.filter((attempt) => {
    const score = Number(attempt.percentage || 0)
    return score >= band.minimum && score <= band.maximum
  }).length }))
  const maxScoreBand = Math.max(...scoreBands.map((band) => band.value), 1)

  const stats = [
    { label: 'Active Classes', value: activeClasses.length, detail: 'Currently available', icon: 'classes' },
    { label: 'Enrolled Students', value: activeEnrollments.length, detail: 'Across all active classes', icon: 'students' },
    { label: 'Completion Rate', value: `${completionRate}%`, detail: 'Assessments completed', icon: 'completion' },
    { label: 'Firearms Available', value: readyFirearms.length, detail: 'Active 3D models', icon: 'firearms' },
  ]

  return (
    <section className="faculty-overview-page" aria-labelledby="faculty-overview-title">
      <div className="faculty-overview-heading">
        <div><nav aria-label="Breadcrumb"><span>Faculty</span><span>›</span><span>Dashboard</span></nav><h1 id="faculty-overview-title">Dashboard</h1></div>
      </div>

      <div className="faculty-overview-metrics">
        {stats.map((stat) => <article key={stat.label}><div><span>{stat.label}</span><i><OverviewIcon name={stat.icon} /></i></div><strong>{loading ? '—' : stat.value}</strong><small>{stat.detail}</small></article>)}
      </div>

      <div className="faculty-overview-grid">
        <section className="faculty-reference-card faculty-active-classes">
          <header><h2>Active Classes</h2><button onClick={() => onNavigate('classes')} type="button">View all <span aria-hidden="true">→</span></button></header>
          <div className="faculty-active-class-grid">
            {activeClasses.slice(0, 3).map((item) => {
              const studentCount = activeEnrollments.filter((enrollment) => enrollment.class_id === item.id).length
              const openCount = openReleases.filter((release) => release.class_id === item.id).length
              return <article key={item.id}><div><h3>{item.name}</h3><span>Active</span></div><p><OverviewIcon name="students" /> {studentCount} {studentCount === 1 ? 'student' : 'students'}</p><footer><small>{openCount > 0 ? `● ${openCount} assessment${openCount === 1 ? '' : 's'} open` : 'No assessments open'}</small><button onClick={() => onManageClass(item.id)} type="button">Manage <span aria-hidden="true">›</span></button></footer></article>
            })}
            {!loading && activeClasses.length === 0 && <p className="faculty-empty-state">No active classes yet.</p>}
          </div>
        </section>

        <section className="faculty-reference-card faculty-attention-card">
          <header><h2>Needs Attention <span>{attention.length}</span></h2></header>
          <div>
            {attention.map((item) => <article key={item.id}><i><OverviewIcon name="attention" /></i><div><p>{item.count} {item.count === 1 ? 'student has' : 'students have'} not completed the {item.firearmName} assessment</p><small>{item.className}</small></div></article>)}
            {!loading && attention.length === 0 && <p className="faculty-empty-state">All open assessments are up to date.</p>}
          </div>
        </section>

        <section className="faculty-reference-card faculty-score-card">
          <header><div><h2>Score Distribution</h2><p>All recorded assessments</p></div></header>
          <div className="faculty-score-chart" aria-label="Assessment score distribution" role="img">
            {scoreBands.map((band) => <div className="faculty-score-column faculty-chart-point" data-tooltip={`${band.label} · ${band.value} ${band.value === 1 ? 'student' : 'students'}`} key={band.label} tabIndex="0"><div><span>{band.value || ''}</span><i style={{ height: `${Math.max((band.value / maxScoreBand) * 100, band.value ? 8 : 0)}%` }} /></div><small>{band.label}</small></div>)}
          </div>
        </section>

        <section className="faculty-reference-card faculty-recent-card">
          <header><h2>Recent Activity</h2><button onClick={() => onNavigate('results')} type="button">See all</button></header>
          <div>
            {submittedAttempts.slice(0, 5).map((attempt) => {
              const name = studentName(attempt.student_id, enrollments)
              const firearm = firearms.find((item) => item.id === attempt.firearm_id)
              return <article key={attempt.id}><span>{name.charAt(0).toUpperCase()}</span><div><strong>{name}</strong><small>{firearm?.name || 'Firearm assessment'}</small></div><div><b>{Math.round(Number(attempt.percentage || 0))}%</b><small>Submitted</small></div></article>
            })}
            {!loading && submittedAttempts.length === 0 && <p className="faculty-empty-state">No submitted assessments yet.</p>}
          </div>
        </section>
      </div>
    </section>
  )
}
