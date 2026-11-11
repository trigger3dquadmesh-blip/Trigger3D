import { useEffect, useState } from 'react'
import { copyText } from '../../lib/clipboard.js'
import AssessmentReleasePanel from './AssessmentReleasePanel.jsx'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import FacultyClassAnalytics from './FacultyClassAnalytics.jsx'
import { assessmentAttemptHasStarted } from '../student/assessment/assessment-lock.js'
import { selectCurrentAssessmentAttempt } from './assessment-status.js'
import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'

function percentage(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`
}

function csvCell(value) {
  const safe = String(value ?? '').replace(/"/g, '""')
  return `"${safe}"`
}

function StudentActions({ assessmentActionLabel, enrollment, hasAttempts, menuOpen, onMenuChange, onReadmit, onRemove, onReset, resetting, updating, classArchived }) {
  return <div className="faculty-student-action-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onMenuChange(false) }}>
    <button aria-expanded={menuOpen} aria-haspopup="menu" aria-label={`Actions for ${enrollment.student?.full_name || enrollment.student?.email || 'student'}`} className="faculty-student-action-toggle" onClick={() => onMenuChange(!menuOpen)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg></button>
    {menuOpen && <div className="faculty-student-action-popover" role="menu">
      {hasAttempts && <button disabled={resetting || classArchived} onClick={() => { onMenuChange(false); onReset() }} role="menuitem" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4v6h6" /><path d="M5.3 16.5A8 8 0 1 0 4 10" /></svg>{resetting ? 'Saving…' : assessmentActionLabel}</button>}
      <button className={enrollment.status === 'active' ? 'remove' : 'readmit'} disabled={updating || classArchived} onClick={() => { onMenuChange(false); enrollment.status === 'active' ? onRemove() : onReadmit() }} role="menuitem" type="button"><svg aria-hidden="true" viewBox="0 0 24 24">{enrollment.status === 'active' ? <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0m2-8h5" /></> : <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0m5-9v6m-3-3h6" /></>}</svg>{updating ? 'Saving…' : enrollment.status === 'active' ? 'Remove student' : 'Re-admit student'}</button>
    </div>}
  </div>
}

export default function FacultyClassWorkspace({ attempts, classItem, enrollments, firearms, loading, onArchive, onAssessmentChange, onBack, onResetAttempt, onResumeInterruptedAttempt, onStatusChange, onUpdateDetails, releases, resettingId, resultRows, updatingId }) {
  const [tab, setTab] = useState('overview')
  const [archiveConfirmationOpen, setArchiveConfirmationOpen] = useState(false)
  const [studentPendingRemoval, setStudentPendingRemoval] = useState(null)
  const [studentPendingReadmission, setStudentPendingReadmission] = useState(null)
  const [attemptPendingReset, setAttemptPendingReset] = useState(null)
  const [studentActionMenu, setStudentActionMenu] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeVisible, setCodeVisible] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')
  const [studentStatus, setStudentStatus] = useState('active')
  const [detailsName, setDetailsName] = useState(classItem.name || '')
  const [detailsTerm, setDetailsTerm] = useState(classItem.term || 'Current term')
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)
  useEffect(() => {
    // Reset the editable draft when the selected class changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailsName(classItem.name || '')
    setDetailsTerm(classItem.term || 'Current term')
    setDetailsSaved(false)
  }, [classItem.id, classItem.name, classItem.term])
  const activeEnrollments = enrollments.filter((item) => item.status === 'active')
  const removedEnrollments = enrollments.filter((item) => item.status === 'removed')
  const activeStudentIds = new Set(activeEnrollments.map((item) => item.student?.id || item.student_id))
  const allClassAttempts = attempts.filter((item) => item.class_id === classItem.id)
  const classAttemptsByAssignment = new Map()
  allClassAttempts
    .filter((item) => activeStudentIds.has(item.student_id))
    .forEach((attempt) => {
      const key = `${attempt.student_id}:${attempt.firearm_id}`
      classAttemptsByAssignment.set(key, [...(classAttemptsByAssignment.get(key) || []), attempt])
    })
  const classAttempts = [...classAttemptsByAssignment.values()]
    .map(selectCurrentAssessmentAttempt)
    .filter(assessmentAttemptIsSubmitted)
  const classReleases = releases.filter((item) => item.class_id === classItem.id)
  const availableAssessments = firearms.filter((item) => item.status === 'ready')
  const expected = activeEnrollments.length * classReleases.length
  const completion = expected ? Math.min(100, (classAttempts.length / expected) * 100) : 0
  const average = classAttempts.length ? classAttempts.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / classAttempts.length : 0
  const passing = classAttempts.length ? classAttempts.filter((item) => Number(item.percentage) >= 75).length / classAttempts.length * 100 : 0
  const lastActivity = [...classAttempts].sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0]?.submitted_at
  const tabs = [['overview', 'Overview'], ['students', 'Students'], ['assessments', 'Assessments'], ['analytics', 'Analytics'], ['settings', 'Settings']]
  const studentRows = enrollments.filter((enrollment) => enrollment.status === studentStatus).map((enrollment) => {
    const studentId = enrollment.student?.id || enrollment.student_id
    const studentAttempts = allClassAttempts.filter((item) => item.student_id === studentId)
    const attemptsByFirearm = new Map()
    studentAttempts.forEach((attempt) => {
      attemptsByFirearm.set(attempt.firearm_id, [
        ...(attemptsByFirearm.get(attempt.firearm_id) || []),
        attempt,
      ])
    })
    const currentAttempts = [...attemptsByFirearm.values()]
      .map(selectCurrentAssessmentAttempt)
      .filter(Boolean)
    const completedAttempts = currentAttempts.filter(assessmentAttemptIsSubmitted)
    const resettableAttempts = currentAttempts.filter((item) => (
      assessmentAttemptIsSubmitted(item)
      || (assessmentAttemptHasStarted(item) && (item.integrity_locked_at || item.connection_interrupted_at))
    ))
    const pausedCount = currentAttempts.filter((item) => assessmentAttemptHasStarted(item) && item.connection_interrupted_at).length
    const lockedCount = currentAttempts.filter((item) => assessmentAttemptHasStarted(item) && !item.connection_interrupted_at && item.integrity_locked_at).length
    const inProgressCount = currentAttempts.filter((item) => assessmentAttemptHasStarted(item) && !item.integrity_locked_at && !item.connection_interrupted_at).length
    const assessmentStates = [
      pausedCount && { className: 'paused', label: 'Paused' },
      lockedCount && { className: 'locked', label: 'Locked' },
      inProgressCount && { className: 'progress', label: 'In progress' },
      completedAttempts.length && { className: 'completed', label: 'Completed' },
    ].filter(Boolean)
    if (!assessmentStates.length) assessmentStates.push({ className: 'not-started', label: 'Not started' })
    const assessmentActionLabel = pausedCount
      ? 'Manage paused assessment'
      : lockedCount
        ? 'Manage locked assessment'
        : 'Manage completed assessment'
    const averageScore = completedAttempts.length ? completedAttempts.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / completedAttempts.length : null
    return { enrollment, studentId, attempts: completedAttempts, assessmentActionLabel, assessmentStates, averageScore, latest: completedAttempts[0], resettableAttempts }
  }).filter(({ enrollment, studentId }) => `${enrollment.student?.full_name || ''} ${enrollment.student?.email || ''} ${studentId || ''}`.toLowerCase().includes(studentQuery.trim().toLowerCase()))

  function exportStudents() {
    const headers = ['Student', 'Email', 'Student ID', 'Completed', 'Assessment Status', 'Average Score', 'Last Score', 'Joined', 'Enrollment Status']
    const rows = studentRows.map(({ enrollment, studentId, attempts: completed, assessmentStates, averageScore: score, latest }) => [enrollment.student?.full_name || '', enrollment.student?.email || '', studentId || '', `${completed.length}/${classReleases.length}`, assessmentStates.map((state) => state.label).join('; '), score === null ? '' : score.toFixed(1), latest?.percentage ?? '', enrollment.enrolled_at || '', enrollment.status])
    const blob = new Blob([[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${classItem.code || classItem.name}-students.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const pendingResetAttempt = attemptPendingReset?.attempts.find((item) => item.id === attemptPendingReset.attemptId)
  const pendingResetAssessment = firearms.find((item) => item.id === pendingResetAttempt?.firearm_id)
  const pendingResetIsInterrupted = pendingResetAttempt?.status === 'in_progress'
    && Boolean(pendingResetAttempt.connection_interrupted_at)

  if (loading) return <section className="faculty-class-workspace"><DashboardLoading label="Loading class…" /></section>

  return <section className={`faculty-class-workspace${classItem.archived_at ? ' is-read-only' : ''}`}>
    <button className="faculty-class-back" onClick={onBack} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>Back to Classes</button>
    <div className="faculty-class-heading"><div><nav><span>Faculty</span><span>›</span><span>Classes</span><span>›</span><span>{classItem.name}</span></nav><h1>{classItem.name}</h1><p>{classItem.term || 'Current term'}{classItem.end_date ? ` · Ends ${new Date(`${classItem.end_date}T00:00:00`).toLocaleDateString('en', { dateStyle: 'medium' })}` : ''}</p></div></div>
    <nav aria-label="Class sections" className="faculty-class-tabs-nav">{tabs.map(([id, label]) => <button aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}{id === 'students' && <span>{activeEnrollments.length}</span>}{id === 'assessments' && <span>{availableAssessments.length}</span>}</button>)}</nav>

    {classItem.archived_at && <section className="faculty-archived-restore-banner" role="status"><div><strong>This class is archived</strong><span>Its students, attempts, scores, and analytics remain available as permanent read-only historical records.</span></div></section>}

    {tab === 'overview' && <><div className="faculty-class-metrics">{[['Enrolled Students', activeEnrollments.length], ['Completion Rate', percentage(completion)], ['Average Score', percentage(average)], ['Passing Rate', percentage(passing)]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{loading ? 'Not available' : value}</strong></article>)}</div><div className="faculty-class-overview-grid"><section className="faculty-reference-card"><header><h2>Class Information</h2></header><dl><div><dt>Class Code</dt><dd><span className="faculty-code-controls"><code>{codeVisible ? classItem.code : '••••••••'}</code><button aria-label={`${codeVisible ? 'Hide' : 'Show'} class code`} aria-pressed={codeVisible} className="faculty-code-visibility" onClick={() => setCodeVisible((visible) => !visible)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24">{codeVisible ? <><path d="m3 3 18 18" /><path d="M10.6 6.1A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.6 16.6 0 0 1-2.1 2.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5" /></> : <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>}</svg></button></span></dd></div><div><dt>Status</dt><dd><span className="faculty-active-pill">{classItem.archived_at ? 'Archived' : 'Active'}</span></dd></div><div><dt>Created</dt><dd>{new Date(classItem.created_at).toLocaleDateString('en', { dateStyle: 'medium' })}</dd></div><div><dt>Last Activity</dt><dd>{lastActivity ? new Date(lastActivity).toLocaleDateString('en', { dateStyle: 'medium' }) : 'No activity yet'}</dd></div></dl></section><section className="faculty-reference-card"><header><h2>Assessments</h2></header><div className="faculty-class-assessment-list">{classReleases.map((release) => { const firearm = firearms.find((item) => item.id === release.firearm_id); const completed = classAttempts.filter((item) => item.firearm_id === release.firearm_id).length; return <article key={release.firearm_id}><div><strong>{firearm?.name || 'Firearm assessment'}</strong><small>{firearm?.caliber || 'Interactive assessment'}</small></div><div><span className={release.is_open ? 'faculty-active-pill' : 'faculty-closed-pill'}>{release.is_open ? 'Open' : 'Closed'}</span><small>{activeEnrollments.length ? Math.round(completed / activeEnrollments.length * 100) : 0}% done</small></div></article> })}{classReleases.length === 0 && <p className="faculty-empty-state">No assessments have been configured.</p>}</div></section></div></>}

    {tab === 'students' && <div className="faculty-students-tab"><div className="faculty-student-status-tabs" aria-label="Student enrollment status"><button aria-pressed={studentStatus === 'active'} className={studentStatus === 'active' ? 'active' : ''} onClick={() => { setStudentStatus('active'); setStudentQuery('') }} type="button">Active <span>{activeEnrollments.length}</span></button><button aria-pressed={studentStatus === 'removed'} className={studentStatus === 'removed' ? 'active' : ''} onClick={() => { setStudentStatus('removed'); setStudentQuery('') }} type="button">Removed <span>{removedEnrollments.length}</span></button></div><div className="faculty-student-tools"><label><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg><input aria-label={`Search ${studentStatus} students`} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by name or student ID" type="search" value={studentQuery} /></label><button disabled={studentRows.length === 0} onClick={exportStudents} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m-4-4 4 4 4-4M5 19h14" /></svg>Export CSV</button></div><section className={`faculty-reference-card faculty-student-table-wrap${studentActionMenu ? ' has-open-menu' : ''}`}><table className="faculty-student-table"><thead><tr><th>Student</th><th>Student ID</th><th>Completed</th><th>Assessment Status</th><th>Avg Score</th><th>Last Score</th><th>Joined</th><th aria-label="Actions" /></tr></thead><tbody>{studentRows.map(({ enrollment, studentId, attempts: completed, assessmentActionLabel, assessmentStates, averageScore: score, latest, resettableAttempts }) => <tr key={enrollment.id}><td><div className="faculty-student-identity"><span>{(enrollment.student?.full_name || enrollment.student?.email || 'S').charAt(0).toUpperCase()}</span><div><strong>{enrollment.student?.full_name || 'Name not provided'}</strong><small>{enrollment.student?.email}</small></div></div></td><td>{studentId ? studentId.slice(0, 8).toUpperCase() : 'Not available'}</td><td>{completed.length} / {classReleases.length}</td><td><div className="faculty-assessment-state-list">{assessmentStates.map((state) => <span className={state.className} key={`${state.className}:${state.label}`}>{state.label}</span>)}</div></td><td className={score !== null && score < 75 ? 'score-low' : 'score-good'}>{score === null ? 'Not available' : percentage(score)}</td><td className={latest && Number(latest.percentage) < 75 ? 'score-low' : 'score-good'}>{latest ? percentage(latest.percentage) : 'Not available'}</td><td>{enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString('en', { dateStyle: 'medium' }) : 'Not available'}</td><td><StudentActions assessmentActionLabel={assessmentActionLabel} classArchived={Boolean(classItem.archived_at)} enrollment={enrollment} hasAttempts={resettableAttempts.length > 0} menuOpen={studentActionMenu === enrollment.id} onMenuChange={(open) => setStudentActionMenu(open ? enrollment.id : '')} onReadmit={() => setStudentPendingReadmission(enrollment)} onRemove={() => setStudentPendingRemoval(enrollment)} onReset={() => setAttemptPendingReset({ attemptId: resettableAttempts[0]?.id || '', attempts: resettableAttempts, enrollment })} resetting={resettableAttempts.some((item) => item.id === resettingId)} updating={updatingId === enrollment.id} /></td></tr>)}</tbody></table>{studentRows.length === 0 && <p className="faculty-empty-state">{studentQuery ? 'No students match your search.' : studentStatus === 'removed' ? 'No removed students in this class.' : 'No active students are enrolled yet.'}</p>}</section></div>}
    {tab === 'assessments' && <AssessmentReleasePanel attempts={attempts} enrollments={enrollments} onChanged={onAssessmentChange} onViewAnalytics={() => setTab('analytics')} selectedClass={classItem} />}
    {tab === 'analytics' && <FacultyClassAnalytics attempts={attempts} classItem={classItem} enrollments={enrollments} firearms={firearms} releases={releases} resultRows={resultRows} />}
    {tab === 'settings' && <div className="faculty-class-settings-grid"><section className="faculty-reference-card"><h2>Class Details</h2><p>{classItem.archived_at ? 'This archived class is a permanent read-only historical record.' : 'Update the class name shown to students. The academic term is controlled by the administrator.'}</p><form className="faculty-class-details-form" onSubmit={async (event) => { event.preventDefault(); if (classItem.archived_at || !onUpdateDetails || detailsName.trim().length < 2 || detailsTerm.trim().length < 2) return; setDetailsSaving(true); setDetailsSaved(false); const saved = await onUpdateDetails(classItem.id, detailsName, detailsTerm); setDetailsSaving(false); setDetailsSaved(Boolean(saved)) }}><label>Class name<input disabled={Boolean(classItem.archived_at)} maxLength="100" minLength="2" onChange={(event) => { setDetailsName(event.target.value); setDetailsSaved(false) }} required value={detailsName} /></label><label>Semester / Term<input disabled readOnly value={detailsTerm} /></label><div>{!classItem.archived_at && <button className="faculty-primary-action" disabled={detailsSaving || detailsName.trim().length < 2} type="submit">{detailsSaving ? 'Saving…' : 'Save details'}</button>}{detailsSaved && <span role="status">Saved</span>}</div></form></section><section className="faculty-reference-card"><h2>Class Status</h2><p>{classItem.archived_at ? 'This archived class is permanently read-only. Students, attempts, scores, and analytics remain available for review.' : 'Archiving this class will permanently prevent new student enrollment and new assessment submissions. Existing student records and scores are preserved.'}</p>{!classItem.archived_at && <button className="faculty-archive-outline" onClick={() => setArchiveConfirmationOpen(true)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M6 7l1 13h10l1-13M9 11h6M5 4h14v3H5z" /></svg>Archive Class</button>}</section><section className="faculty-reference-card"><h2>Class Code</h2><p>{classItem.archived_at ? 'This enrollment code is inactive and retained only for reference.' : 'Share this code with students so they can join this class.'}</p><div className="faculty-code-controls"><button aria-label={`Copy class code for ${classItem.name}`} className={`faculty-code-large${codeCopied ? ' copied' : ''}`} disabled={Boolean(classItem.archived_at)} onClick={async () => { if (await copyText(classItem.code)) { setCodeCopied(true); window.setTimeout(() => setCodeCopied(false), 1800) } }} title={codeCopied ? 'Copied!' : 'Copy class code'} type="button">{codeCopied ? 'Copied!' : codeVisible ? classItem.code : '••••••••'}</button><button aria-label={`${codeVisible ? 'Hide' : 'Show'} class code for ${classItem.name}`} aria-pressed={codeVisible} className="faculty-code-visibility" onClick={() => setCodeVisible((visible) => !visible)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24">{codeVisible ? <><path d="m3 3 18 18" /><path d="M10.6 6.1A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.6 16.6 0 0 0-2.1 2.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5" /></> : <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>}</svg></button></div></section></div>}
    {attemptPendingReset && pendingResetAttempt && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="reset-attempt-title" aria-modal="true" className="confirmation-dialog faculty-archive-dialog" role="dialog"><div className="faculty-archive-dialog-copy"><span className="faculty-reset-dialog-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4v6h6" /><path d="M5.3 16.5A8 8 0 1 0 4 10" /></svg></span><div><h2 id="reset-attempt-title">{pendingResetIsInterrupted ? 'Connection recovery request' : 'Manage assessment attempt'}</h2><p>{pendingResetIsInterrupted ? <>Approve continuation for <strong>{attemptPendingReset.enrollment.student?.full_name || attemptPendingReset.enrollment.student?.email || 'this student'}</strong>. Their saved work will remain protected.</> : <>Select the exact assessment attempt for <strong>{attemptPendingReset.enrollment.student?.full_name || attemptPendingReset.enrollment.student?.email || 'this student'}</strong>. No other assessment will be changed.</>}</p></div></div><label className="faculty-reset-assessment-field">Assessment<select onChange={(event) => setAttemptPendingReset((current) => ({ ...current, attemptId: event.target.value }))} value={pendingResetAttempt.id}>{attemptPendingReset.attempts.map((attempt) => { const firearm = firearms.find((item) => item.id === attempt.firearm_id); const attemptStatus = attempt.status === 'submitted' ? 'Submitted' : attempt.connection_interrupted_at ? 'Connection interrupted' : attempt.integrity_locked_at ? 'Access locked' : 'In progress'; return <option key={attempt.id} value={attempt.id}>{firearm?.name || 'Firearm assessment'} — {attemptStatus}</option> })}</select></label><div className="faculty-reset-assessment-summary"><strong>{pendingResetAssessment?.name || 'Firearm assessment'}</strong><span>{pendingResetAttempt.status === 'submitted' ? `Submitted · ${percentage(pendingResetAttempt.percentage)}` : pendingResetIsInterrupted ? `Connection interrupted · Question ${Number(pendingResetAttempt.checkpoint_question_index || 0) + 1}` : pendingResetAttempt.integrity_locked_at ? 'Access locked' : 'In progress'}</span><small>{pendingResetIsInterrupted ? 'Continuation preserves the saved answers, current question, and remaining time. This interrupted attempt cannot be reset.' : 'Restart clears the answers and timer for only this attempt.'}</small></div><div className="confirmation-actions"><button disabled={resettingId === pendingResetAttempt.id} onClick={() => setAttemptPendingReset(null)} type="button">Cancel</button>{pendingResetIsInterrupted ? <button className="faculty-primary-action" disabled={resettingId === pendingResetAttempt.id} onClick={async () => { if (await onResumeInterruptedAttempt(pendingResetAttempt)) setAttemptPendingReset(null) }} type="button">{resettingId === pendingResetAttempt.id ? 'Approving…' : 'Approve continuation'}</button> : <button className="danger-action" disabled={resettingId === pendingResetAttempt.id} onClick={async () => { if (await onResetAttempt(pendingResetAttempt)) setAttemptPendingReset(null) }} type="button">{resettingId === pendingResetAttempt.id ? 'Resetting…' : 'Restart from question 1'}</button>}</div></section></div>}
    {studentPendingRemoval && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="remove-student-title" aria-modal="true" className="confirmation-dialog faculty-archive-dialog" role="dialog"><div className="faculty-archive-dialog-copy"><span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 9v4m0 3h.01M10.2 4.8 3.4 17a2 2 0 0 0 1.8 3h13.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" /></svg></span><div><h2 id="remove-student-title">Remove {studentPendingRemoval.student?.full_name || studentPendingRemoval.student?.email || 'this student'}?</h2><p>They will lose access to {classItem.name} and cannot join it again until you re-admit them. Their enrollment, answers, and assessment scores will remain saved.</p></div></div><div className="confirmation-actions"><button disabled={updatingId === studentPendingRemoval.id} onClick={() => setStudentPendingRemoval(null)} type="button">Cancel</button><button className="danger-action" disabled={updatingId === studentPendingRemoval.id} onClick={async () => { if (await onStatusChange(studentPendingRemoval)) setStudentPendingRemoval(null) }} type="button">{updatingId === studentPendingRemoval.id ? 'Removing…' : 'Remove Student'}</button></div></section></div>}
    {studentPendingReadmission && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="readmit-student-title" aria-modal="true" className="confirmation-dialog faculty-archive-dialog" role="dialog"><div className="faculty-archive-dialog-copy"><span className="faculty-readmit-dialog-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 12l3 3 5-6" /><circle cx="12" cy="12" r="9" /></svg></span><div><h2 id="readmit-student-title">Re-admit {studentPendingReadmission.student?.full_name || studentPendingReadmission.student?.email || 'this student'}?</h2><p>The student will regain access to {classItem.name}, its learning resources, and open assessments. Their previously saved answers and scores will remain available.</p></div></div><div className="confirmation-actions"><button disabled={updatingId === studentPendingReadmission.id} onClick={() => setStudentPendingReadmission(null)} type="button">Cancel</button><button className="faculty-primary-action" disabled={updatingId === studentPendingReadmission.id} onClick={async () => { if (await onStatusChange(studentPendingReadmission)) setStudentPendingReadmission(null) }} type="button">{updatingId === studentPendingReadmission.id ? 'Re-admitting…' : 'Re-admit Student'}</button></div></section></div>}
    {archiveConfirmationOpen && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="archive-class-title" aria-modal="true" className="confirmation-dialog faculty-archive-dialog" role="dialog"><div className="faculty-archive-dialog-copy"><span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 9v4m0 3h.01M10.2 4.8 3.4 17a2 2 0 0 0 1.8 3h13.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" /></svg></span><div><h2 id="archive-class-title">Archive &quot;{classItem.name}&quot;?</h2><p>New enrollments and assessment submissions will be permanently disabled. Existing students, attempts, scores, and analytics will remain available as read-only historical records. This class cannot be restored after archiving.</p></div></div><div className="confirmation-actions"><button onClick={() => setArchiveConfirmationOpen(false)} type="button">Cancel</button><button className="danger-action" onClick={() => { setArchiveConfirmationOpen(false); onArchive(true) }} type="button">Archive Class</button></div></section></div>}
  </section>
}
