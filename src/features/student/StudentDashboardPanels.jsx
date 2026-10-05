import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import { getStudentFirearmDestination } from './assessment/assessment-lock.js'
import { hasViewedFirearm } from './viewer/viewed-firearms.js'
import { supabase } from '../../lib/supabase.js'

function HistoryIcon() {
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
}

function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0 }
function pct(value) { const number = Number(value || 0); return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%` }
function facultyName(classItem) { return classItem?.faculty?.full_name || classItem?.faculty?.email || 'Faculty instructor' }
const RESULTS_PAGE_SIZE = 5

function ResultDisclosure({ attempt, className }) {
  const passed = Number(attempt.percentage) >= 75
  return <details className="student-result-disclosure"><summary><div className="student-result-name"><strong>{attempt.firearm?.name || 'Assessment'}</strong><small>{attempt.firearm?.caliber || 'Component assessment'}</small></div><strong className="student-result-score">{pct(attempt.percentage)}</strong><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></summary><div className="student-result-details"><p><span>Class</span><strong>{className}</strong></p><p><span>Status</span><strong className={passed ? 'passed' : 'review'}>{passed ? 'Passed' : 'Review'}</strong></p><p><span>Submitted</span><strong>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('en', { dateStyle: 'medium' }) : 'Not available'}</strong></p><Link to={`/student/models/${attempt.firearm_id}/assessment?classId=${encodeURIComponent(attempt.class_id)}`}>Review answers</Link></div></details>
}

export function StudentJoinDialog({ classCode, error, joining, onChange, onClose, onSubmit }) {
  return <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="student-join-title" aria-modal="true" className="student-join-dialog" role="dialog"><header><div><h2 id="student-join-title">Join a Class</h2><p>Enter the class code provided by your faculty.</p></div><button aria-label="Close join class dialog" onClick={onClose} type="button">×</button></header><form onSubmit={onSubmit}><label>Class Code<input autoFocus disabled={joining} maxLength="16" onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="E.G. TRG-2024-IFB" required value={classCode} /></label><small>Enter the exact code shared by your faculty instructor.</small>{error && <div className="alert alert-error" role="alert">{error}</div>}<footer><button disabled={joining} onClick={onClose} type="button">Cancel</button><button className="student-primary-action" disabled={joining} type="submit">{joining ? 'Joining…' : 'Join Class'}</button></footer></form></section></div>
}

export function StudentOverview({ attempts, enrollments, firearms, loading, onJoin, onNavigate, onOpenClass, releases }) {
  const active = enrollments.filter((item) => item.class && item.status === 'active' && !item.class.archived_at)
  const history = enrollments.filter((item) => item.class && (item.status === 'removed' || item.class.archived_at))
  const activeIds = new Set(active.map((item) => item.class.id))
  const submitted = attempts.filter((item) => item.status === 'submitted')
  const activeSubmitted = submitted.filter((item) => activeIds.has(item.class_id))
  const open = releases.filter((item) => item.is_open && activeIds.has(item.class_id) && !activeSubmitted.some((attempt) => attempt.class_id === item.class_id && attempt.firearm_id === item.firearm_id))
  const stats = [['Active Classes', active.length], ['Completed', submitted.length, 'Assessments'], ['Pending', open.length, 'Open assessments'], ['Average Score', `${Math.round(average(submitted.map((item) => item.percentage)))}%`]]
  if (loading) return <section className="student-reference-page"><DashboardLoading label="Loading dashboard…" /></section>
  return <section className="student-reference-page"><div className="student-page-heading"><div><nav><span>Student</span><span>›</span><span>Dashboard</span></nav><h1>Dashboard</h1></div></div><div className="student-metrics">{stats.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{loading ? 'Not available' : value}</strong>{detail && <small>{detail}</small>}</article>)}</div><div className="student-dashboard-grid"><section className="student-card student-my-classes"><header><h2>My Classes</h2><button onClick={() => onNavigate('classes')} type="button">View all ›</button></header>{active.slice(0, 3).map((enrollment) => { const classReleases = releases.filter((item) => item.class_id === enrollment.class.id); const done = activeSubmitted.filter((item) => item.class_id === enrollment.class.id).length; return <button className="student-class-row" key={enrollment.id} onClick={() => onOpenClass(enrollment.class.id)} type="button"><div><strong>{enrollment.class.name}</strong><small>{enrollment.class.term || 'Current term'} · {facultyName(enrollment.class)}</small></div><span>{done}/{classReleases.length}<small>assessments</small></span><b>Active</b><i>›</i></button> })}{!loading && active.length === 0 && (history.length ? <div className="student-empty-state restricted"><span aria-hidden="true">⊘</span><div><strong>Class access removed</strong><p>Your learning materials and new assessments are restricted. Your submitted grades and answer reviews remain available.</p></div><button onClick={() => onNavigate('classes')} type="button">View history</button></div> : <div className="student-empty-state new-student"><span aria-hidden="true">＋</span><div><strong>Join your first class</strong><p>Enter the class code provided by your Faculty instructor to access learning resources and assessments.</p></div><button onClick={onJoin} type="button">Join a class</button></div>)}{(loading || active.length > 0 || history.length > 0) && <button className="student-join-another" onClick={onJoin} type="button">＋ Join another class</button>}</section><section className="student-card student-open-assessments"><header><h2>Open Assessments <span>{open.length}</span></h2></header>{open.slice(0, 3).map((release) => { const firearm = firearms.find((item) => item.id === release.firearm_id); return <Link key={`${release.class_id}:${release.firearm_id}`} to={`/student/models/${release.firearm_id}/assessment?classId=${encodeURIComponent(release.class_id)}`}><div><strong>{firearm?.name || 'Assessment'}</strong><small>{firearm?.caliber}</small><small>{active.find((item) => item.class.id === release.class_id)?.class.name}</small></div><span>›</span></Link> })}{!loading && open.length === 0 && <p className="student-empty">{history.length && !active.length ? 'Assessment access is unavailable until your Faculty instructor re-admits you.' : 'No open assessments.'}</p>}</section><section className="student-card student-recent-results"><header><h2>Recent Results</h2>{submitted.length > 0 && <button onClick={() => onNavigate('results')} type="button">View all ›</button>}</header><div className="student-result-disclosures">{submitted.slice(0, 3).map((attempt) => <ResultDisclosure attempt={attempt} className={enrollments.find((item) => item.class?.id === attempt.class_id)?.class?.name || 'Previous class'} key={attempt.id} />)}</div>{!loading && submitted.length === 0 && <p className="student-empty">No submitted assessments yet.</p>}</section></div></section>
}

export function StudentClasses({ attempts, enrollments, loading = false, onOpenClass, releases }) {
  const [status, setStatus] = useState('active')
  if (loading) return <section className="student-reference-page"><DashboardLoading label="Loading classes…" /></section>
  const active = enrollments.filter((item) => item.class && item.status === 'active' && !item.class.archived_at)
  const archived = enrollments.filter((item) => item.class && (item.status === 'removed' || item.class.archived_at))
  const visible = status === 'active' ? active : archived

  return <section className="student-reference-page">
    <div className="student-page-heading">
      <div><nav><span>Student</span><span>›</span><span>My Classes</span></nav><h1>My Classes</h1></div>
    </div>
    <div className="student-class-tabs">
      <button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')} type="button">Active <span>{active.length}</span></button>
      <button className={status === 'archived' ? 'active' : ''} onClick={() => setStatus('archived')} type="button">History <span>{archived.length}</span></button>
    </div>
    <section className={`student-card student-class-list${status === 'archived' ? ' history-view' : ''}`}>
      {visible.map((enrollment) => {
        const classAttempts = attempts.filter((item) => item.class_id === enrollment.class.id && item.status === 'submitted').length
        const classReleases = releases.filter((item) => item.class_id === enrollment.class.id).length
        const openAssessments = releases.filter((item) => item.class_id === enrollment.class.id && item.is_open && !attempts.some((attempt) => attempt.class_id === enrollment.class.id && attempt.firearm_id === item.firearm_id && attempt.status === 'submitted')).length
        const completion = classReleases ? Math.min(100, Math.round(classAttempts / classReleases * 100)) : 0
        const historicalStatus = enrollment.class.archived_at ? 'Archived' : 'Removed'
        const canOpen = true
        return <button className={status === 'archived' ? 'history-only' : ''} key={enrollment.id} onClick={() => onOpenClass(enrollment.class.id)} type="button">
          <div>
            <strong>{enrollment.class.name}</strong>
            <small>{enrollment.class.term || 'Current term'} · {facultyName(enrollment.class)}</small>
            <p>{canOpen ? <>{classAttempts}/{classReleases} completed · {openAssessments} open · {classReleases} firearm{classReleases === 1 ? '' : 's'}</> : <>{classAttempts} completed assessment{classAttempts === 1 ? '' : 's'} · Class access restricted</>}</p>{canOpen && <div aria-label={`${completion}% of assessments completed`} className="student-class-progress"><i><span style={{ width: `${completion}%` }} /></i><small>{completion}% complete</small></div>}
          </div>
          <span className={status === 'active' ? 'active' : ''}>{status === 'active' ? 'Active' : historicalStatus}</span><i className="student-class-open-indicator"><span>{status === 'active' ? 'Open class' : 'View record'}</span><b aria-hidden="true">›</b></i>
        </button>
      })}
      {visible.length === 0 && <div className={`student-empty-state ${status === 'active' && archived.length ? 'restricted' : status === 'active' ? 'new-student' : 'history-empty'}`}><span aria-hidden="true">{status === 'active' && archived.length ? '⊘' : status === 'active' ? '+' : <HistoryIcon />}</span><div><strong>{status === 'active' && archived.length ? 'No active class access' : status === 'active' ? 'No classes joined yet' : 'No class history yet'}</strong><p>{status === 'active' && archived.length ? 'Open the Archived tab to see preserved class and result history.' : status === 'active' ? 'Join a class using the code provided by your Faculty instructor.' : 'Archived classes and removed enrollments will appear here.'}</p></div></div>}
    </section>
  </section>
}

export function StudentResults({ attempts, enrollments, loading }) {
  const [page, setPage] = useState(0)
  const submitted = attempts.filter((item) => item.status === 'submitted')
  const averageScore = average(submitted.map((item) => item.percentage))
  const bestScore = submitted.length ? Math.max(...submitted.map((item) => Number(item.percentage || 0))) : 0
  const className = (classId) => enrollments.find((item) => item.class?.id === classId)?.class?.name || 'Previous class'
  const pageCount = Math.max(1, Math.ceil(submitted.length / RESULTS_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = submitted.slice(currentPage * RESULTS_PAGE_SIZE, (currentPage + 1) * RESULTS_PAGE_SIZE)
  if (loading) return <section className="student-reference-page"><DashboardLoading label="Loading results…" /></section>

  return <section className="student-reference-page student-results-page">
    <div className="student-page-heading"><div><nav><span>Student</span><span>›</span><span>My Results</span></nav><h1>My Results</h1><p>Review your submitted assessment grades and learn from incorrect answers.</p></div></div>
    <div className="student-metrics">
      <article><span>Completed</span><strong>{loading ? 'Loading…' : submitted.length}</strong><small>Assessments</small></article>
      <article><span>Average Score</span><strong>{loading ? 'Loading…' : pct(averageScore)}</strong></article>
      <article><span>Best Score</span><strong>{loading ? 'Loading…' : pct(bestScore)}</strong></article>
    </div>
    <section className="student-card student-results-list">
      <header><h2>Assessment history</h2></header>
      <div>
        {visible.map((attempt) => <article key={attempt.id}>
          <div><strong>{attempt.firearm?.name || 'Assessment'}</strong><small>{className(attempt.class_id)} · {attempt.firearm?.caliber || 'Component assessment'}</small><small>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : 'Submitted'}</small></div>
          <div className="student-result-grade"><strong>{pct(attempt.percentage)}</strong><span>{attempt.correct_count} / {attempt.total_questions} correct</span></div>
          <Link to={`/student/models/${attempt.firearm_id}/assessment?classId=${encodeURIComponent(attempt.class_id)}`}>Review answers</Link>
        </article>)}
      </div>
      {submitted.length > RESULTS_PAGE_SIZE && <footer className="student-results-pagination"><button disabled={currentPage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">← Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button disabled={currentPage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} type="button">Next →</button></footer>}
      {!loading && submitted.length === 0 && <p className="student-empty">Your submitted assessment results will appear here.</p>}
    </section>
  </section>
}

export function StudentClassDetail({ attempts, components, enrollment, firearms, onBack, releases, studentId }) {
  const [tab, setTab] = useState('resources')
  const [assessmentFilter, setAssessmentFilter] = useState('all')
  const [firearmFilter, setFirearmFilter] = useState('all')
  const [viewedFirearmIds, setViewedFirearmIds] = useState(() => new Set())
  const classId = enrollment.class.id
  const classReleases = releases.filter((item) => item.class_id === classId).map((item) => (
    enrollment.class.archived_at ? { ...item, is_open: false } : item
  ))
  const resources = firearms.filter((item) => classReleases.some((release) => release.firearm_id === item.id))
  const assessmentStatus = (release) => {
    const attempt = attempts.find((item) => item.class_id === classId && item.firearm_id === release.firearm_id)
    return attempt?.status === 'submitted' ? 'completed' : release.is_open ? 'open' : 'closed'
  }
  const assessmentCounts = classReleases.reduce((counts, release) => ({ ...counts, [assessmentStatus(release)]: counts[assessmentStatus(release)] + 1 }), { open: 0, completed: 0, closed: 0 })
  const visibleReleases = assessmentFilter === 'all' ? classReleases : classReleases.filter((release) => assessmentStatus(release) === assessmentFilter)
  useEffect(() => {
    let active = true
    if (!studentId || !classId) return undefined
    supabase.from('student_firearm_views').select('firearm_id').eq('student_id', studentId).eq('class_id', classId).then(({ data }) => {
      if (active && data) setViewedFirearmIds(new Set(data.map((item) => item.firearm_id)))
    })
    return () => { active = false }
  }, [classId, studentId])
  const firearmViewed = (firearmId) => viewedFirearmIds.has(firearmId) || hasViewedFirearm(localStorage, studentId, classId, firearmId)
  const viewedCount = resources.filter((firearm) => firearmViewed(firearm.id)).length
  const visibleResources = firearmFilter === 'all' ? resources : resources.filter((firearm) => firearmViewed(firearm.id) === (firearmFilter === 'viewed'))

  return <section className="student-reference-page student-class-detail">
    <button aria-label="Back to My Classes" className="student-class-back" onClick={onBack} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>Back to My Classes</button>
    <div className="student-page-heading"><div><nav><span>Student</span><span>›</span><span>My Classes</span><span>›</span><span>{enrollment.class.name}</span></nav><h1>{enrollment.class.name}</h1></div></div>
    <div className="student-class-meta"><span>{enrollment.class.archived_at ? 'Read only' : 'Active'}</span><b>{enrollment.class.term || 'Current term'}</b></div>
    <div className="student-class-tabs detail">
      <button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')} type="button">Firearm Resources <span>{resources.length}</span></button>
      <button className={tab === 'assessments' ? 'active' : ''} onClick={() => setTab('assessments')} type="button">Assessments <span>{classReleases.length}</span></button>
    </div>
    {tab === 'resources' && <><div className="student-filter-select"><label htmlFor="student-firearm-filter">Show firearms</label><select id="student-firearm-filter" aria-label="Filter firearms by viewing status" onChange={(event) => setFirearmFilter(event.target.value)} value={firearmFilter}><option value="all">All ({resources.length})</option><option value="not-viewed">Not viewed ({resources.length - viewedCount})</option><option value="viewed">Viewed ({viewedCount})</option></select></div><div className="student-resource-grid">{visibleResources.map((firearm) => {
      const componentCount = components.filter((item) => item.firearm_id === firearm.id).length
      const attempt = attempts.find((item) => item.class_id === classId && item.firearm_id === firearm.id)
      const destination = getStudentFirearmDestination(firearm.id, attempt?.status === 'in_progress', classId)
      const assessmentUrl = `/student/models/${firearm.id}/assessment?classId=${encodeURIComponent(classId)}`
      return <article className="admin-firearm-live-card student-firearm-card" key={firearm.id}><div className="student-firearm-heading"><div><strong>{firearm.name}</strong><span>{firearm.identifier}</span></div><b className={firearmViewed(firearm.id) ? 'viewed' : ''}>{firearmViewed(firearm.id) ? 'Viewed' : 'Not viewed'}</b></div><p>{firearm.description || 'No firearm description provided.'}</p><dl><div><dt>Caliber</dt><dd>{firearm.caliber || 'Not provided'}</dd></div><div><dt>Components</dt><dd>{componentCount}</dd></div><div><dt>Classification</dt><dd>{firearm.firearm_type?.replace('_', ' ') || 'Not provided'}</dd></div></dl>{firearm.tutorial_url && <a className="student-firearm-tutorial" href={firearm.tutorial_url} rel="noreferrer" target="_blank">▶ Watch YouTube tutorial</a>}<footer><Link to={destination}>◉ Open firearm</Link>{attempt?.status === 'submitted' && <Link to={assessmentUrl}>View Result</Link>}</footer></article>
    })}</div></>}
    {tab === 'assessments' && <div className="student-assessment-section"><div className="student-filter-select"><label htmlFor="student-assessment-filter">Show assessments</label><select id="student-assessment-filter" aria-label="Filter assessments by status" onChange={(event) => setAssessmentFilter(event.target.value)} value={assessmentFilter}><option value="all">All ({classReleases.length})</option><option value="open">Open ({assessmentCounts.open})</option><option value="completed">Completed ({assessmentCounts.completed})</option><option value="closed">Closed ({assessmentCounts.closed})</option></select></div><div className="student-assessment-list">{visibleReleases.map((release) => { const firearm = firearms.find((item) => item.id === release.firearm_id); const attempt = attempts.find((item) => item.class_id === classId && item.firearm_id === release.firearm_id); const assessmentUrl = `/student/models/${release.firearm_id}/assessment?classId=${encodeURIComponent(classId)}`; return <article key={release.firearm_id}><div><h2>{firearm?.name || 'Assessment'} <span className={attempt?.status === 'submitted' ? 'complete' : release.is_open ? 'open' : 'closed'}>{attempt?.status === 'submitted' ? 'Completed' : release.is_open ? 'Open' : 'Closed'}</span></h2><p>{firearm?.caliber}</p><small>{attempt?.status === 'submitted' ? `Score: ${pct(attempt.percentage)}` : release.is_open ? 'Ready to begin' : 'Waiting for faculty'}</small></div>{attempt?.status === 'submitted' ? <Link to={assessmentUrl}>View Result</Link> : release.is_open ? <Link className="student-primary-action" to={assessmentUrl}>Start Assessment</Link> : null}</article> })}{visibleReleases.length === 0 && <p className="student-assessment-empty">No assessments in this filter.</p>}</div></div>}
  </section>
}
