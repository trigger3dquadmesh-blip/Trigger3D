import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getStudentFirearmDestination } from './assessment/assessment-lock.js'

function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0 }
function pct(value) { const number = Number(value || 0); return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%` }
function facultyName(classItem) { return classItem?.faculty?.full_name || classItem?.faculty?.email || 'Faculty instructor' }

export function StudentJoinDialog({ classCode, error, joining, onChange, onClose, onSubmit }) {
  return <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="student-join-title" aria-modal="true" className="student-join-dialog" role="dialog"><header><div><h2 id="student-join-title">Join a Class</h2><p>Enter the class code provided by your faculty.</p></div><button aria-label="Close join class dialog" onClick={onClose} type="button">×</button></header><form onSubmit={onSubmit}><label>Class Code<input autoFocus disabled={joining} maxLength="16" onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="E.G. TRG-2024-IFB" required value={classCode} /></label><small>Enter the exact code shared by your faculty instructor.</small>{error && <div className="alert alert-error" role="alert">{error}</div>}<footer><button disabled={joining} onClick={onClose} type="button">Cancel</button><button className="student-primary-action" disabled={joining} type="submit">{joining ? 'Joining…' : 'Join Class'}</button></footer></form></section></div>
}

export function StudentOverview({ attempts, enrollments, firearms, loading, onJoin, onNavigate, onOpenClass, releases }) {
  const active = enrollments.filter((item) => item.class && item.status === 'active' && !item.class.archived_at)
  const activeIds = new Set(active.map((item) => item.class.id))
  const submitted = attempts.filter((item) => item.status === 'submitted' && activeIds.has(item.class_id))
  const open = releases.filter((item) => item.is_open && activeIds.has(item.class_id) && !submitted.some((attempt) => attempt.class_id === item.class_id && attempt.firearm_id === item.firearm_id))
  const stats = [['Enrolled Classes', active.length], ['Completed', submitted.length, 'Assessments'], ['Pending', open.length, 'Open assessments'], ['Average Score', `${Math.round(average(submitted.map((item) => item.percentage)))}%`]]
  return <section className="student-reference-page"><div className="student-page-heading"><div><nav><span>Student</span><span>›</span><span>Dashboard</span></nav><h1>Dashboard</h1></div><button className="student-primary-action" onClick={onJoin} type="button">＋ Join Class</button></div><div className="student-metrics">{stats.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong>{detail && <small>{detail}</small>}</article>)}</div><div className="student-dashboard-grid"><section className="student-card student-my-classes"><header><h2>My Classes</h2><button onClick={() => onNavigate('classes')} type="button">View all ›</button></header>{active.slice(0, 3).map((enrollment) => { const classReleases = releases.filter((item) => item.class_id === enrollment.class.id); const done = submitted.filter((item) => item.class_id === enrollment.class.id).length; return <button className="student-class-row" key={enrollment.id} onClick={() => onOpenClass(enrollment.class.id)} type="button"><div><strong>{enrollment.class.name}</strong><small>{facultyName(enrollment.class)}</small></div><span>{done}/{classReleases.length}<small>assessments</small></span><b>Active</b><i>›</i></button> })}{!loading && active.length === 0 && <p className="student-empty">No active classes yet.</p>}<button className="student-join-another" onClick={onJoin} type="button">＋ Join another class</button></section><section className="student-card student-open-assessments"><header><h2>Open Assessments <span>{open.length}</span></h2></header>{open.slice(0, 3).map((release) => { const firearm = firearms.find((item) => item.id === release.firearm_id); return <Link key={`${release.class_id}:${release.firearm_id}`} to={`/student/models/${release.firearm_id}/assessment`}><div><strong>{firearm?.name || 'Assessment'}</strong><small>{firearm?.caliber}</small><small>{active.find((item) => item.class.id === release.class_id)?.class.name}</small></div><span>›</span></Link> })}{!loading && open.length === 0 && <p className="student-empty">No open assessments.</p>}</section><section className="student-card student-recent-results"><header><h2>Recent Results</h2></header><table><thead><tr><th>Assessment</th><th>Class</th><th>Score</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{submitted.slice(0, 6).map((attempt) => <tr key={attempt.id}><td><strong>{attempt.firearm?.name}</strong><small>{attempt.firearm?.caliber}</small></td><td>{active.find((item) => item.class.id === attempt.class_id)?.class.name || 'Class'}</td><td><strong>{pct(attempt.percentage)}</strong></td><td><span className={Number(attempt.percentage) >= 75 ? 'passed' : 'review'}>{Number(attempt.percentage) >= 75 ? 'Passed' : 'Review'}</span></td><td>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('en', { dateStyle: 'medium' }) : '—'}</td></tr>)}</tbody></table>{!loading && submitted.length === 0 && <p className="student-empty">No submitted assessments yet.</p>}</section></div></section>
}

export function StudentClasses({ attempts, enrollments, onJoin, onOpenClass, releases }) {
  const [status, setStatus] = useState('active')
  const active = enrollments.filter((item) => item.class && item.status === 'active' && !item.class.archived_at)
  const archived = enrollments.filter((item) => item.class?.archived_at)
  const visible = status === 'active' ? active : archived

  return <section className="student-reference-page">
    <div className="student-page-heading">
      <div><nav><span>Student</span><span>›</span><span>My Classes</span></nav><h1>My Classes</h1></div>
      <button className="student-primary-action" onClick={onJoin} type="button">＋ Join Class</button>
    </div>
    <div className="student-class-tabs">
      <button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')} type="button">Active <span>{active.length}</span></button>
      <button className={status === 'archived' ? 'active' : ''} onClick={() => setStatus('archived')} type="button">Archived <span>{archived.length}</span></button>
    </div>
    <section className="student-card student-class-list">
      {visible.map((enrollment) => {
        const classAttempts = attempts.filter((item) => item.class_id === enrollment.class.id && item.status === 'submitted').length
        const classReleases = releases.filter((item) => item.class_id === enrollment.class.id).length
        return <button key={enrollment.id} onClick={() => onOpenClass(enrollment.class.id)} type="button">
          <div>
            <strong>{enrollment.class.name}</strong>
            <small>{facultyName(enrollment.class)}</small>
            <p>{classAttempts}/{classReleases} assessments · {classReleases} firearms · <code>{enrollment.class.code}</code></p>
          </div>
          <span className={status === 'active' ? 'active' : ''}>{status === 'active' ? 'Active' : 'Archived'}</span><i>›</i>
        </button>
      })}
      {visible.length === 0 && <p className="student-empty">No {status} classes.</p>}
    </section>
  </section>
}

export function StudentClassDetail({ attempts, components, enrollment, firearms, onLeave, releases }) {
  const [tab, setTab] = useState('resources')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const classId = enrollment.class.id
  const classReleases = releases.filter((item) => item.class_id === classId)
  const resources = firearms.filter((item) => classReleases.some((release) => release.firearm_id === item.id))
  return <section className="student-reference-page student-class-detail"><div className="student-page-heading"><div><nav><span>Student</span><span>›</span><span>My Classes</span><span>›</span><span>{enrollment.class.name}</span></nav><h1>{enrollment.class.name}</h1></div><button className="student-leave-action" onClick={() => setLeaveOpen(true)} type="button">↪ Leave Class</button></div><p className="student-class-meta"><span>Active</span><b>{facultyName(enrollment.class)}</b><code>{enrollment.class.code}</code></p><div className="student-class-tabs detail"><button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')} type="button">Firearm Resources <span>{resources.length}</span></button><button className={tab === 'assessments' ? 'active' : ''} onClick={() => setTab('assessments')} type="button">Assessments <span>{classReleases.length}</span></button></div>{tab === 'resources' ? <div className="student-resource-grid">{resources.map((firearm) => <Link key={firearm.id} to={getStudentFirearmDestination(firearm.id, attempts.some((item) => item.firearm_id === firearm.id && item.status === 'in_progress'))}><span>◉</span><strong>{firearm.name}</strong><small>{firearm.description || firearm.caliber}</small><footer>{components.filter((item) => item.firearm_id === firearm.id).length} components <b>›</b></footer></Link>)}</div> : <div className="student-assessment-list">{classReleases.map((release) => { const firearm = firearms.find((item) => item.id === release.firearm_id); const attempt = attempts.find((item) => item.class_id === classId && item.firearm_id === release.firearm_id); return <article key={release.firearm_id}><div><h2>{firearm?.name || 'Assessment'} <span className={attempt?.status === 'submitted' ? 'complete' : release.is_open ? 'open' : 'closed'}>{attempt?.status === 'submitted' ? 'Completed' : release.is_open ? 'Open' : 'Closed'}</span></h2><p>{firearm?.caliber}</p><small>{attempt?.status === 'submitted' ? `Score: ${pct(attempt.percentage)}` : release.is_open ? 'Ready to begin' : 'Waiting for faculty'}</small></div>{attempt?.status === 'submitted' ? <Link to={`/student/models/${release.firearm_id}/assessment`}>View Result</Link> : release.is_open ? <Link className="student-primary-action" to={`/student/models/${release.firearm_id}/assessment`}>Start Assessment</Link> : null}</article> })}</div>}{leaveOpen && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="leave-class-title" aria-modal="true" className="confirmation-dialog" role="dialog"><h2 id="leave-class-title">Leave {enrollment.class.name}?</h2><p>You will lose access to its resources and open assessments. Existing results will be preserved.</p><div className="confirmation-actions"><button disabled={leaving} onClick={() => setLeaveOpen(false)} type="button">Cancel</button><button className="danger-action" disabled={leaving} onClick={async () => { setLeaving(true); const left = await onLeave(classId); if (!left) setLeaving(false) }} type="button">{leaving ? 'Leaving…' : 'Leave Class'}</button></div></section></div>}</section>
}
