import { useMemo, useState } from 'react'
import { copyText } from '../../lib/clipboard.js'

function SmallIcon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    students: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20" /><path d="M17 5.5a3 3 0 0 1 0 5.7" /></>,
    assessment: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="m9 12 2 2 4-4" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 6.1A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.6 16.6 0 0 1-2.1 2.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5" /></>,
  }
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>
}

function formatActivity(value) {
  if (!value) return 'No activity yet'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function FacultyClassesPanel({ attempts, className, classes, creating, enrollments, loading, onClassNameChange, onCreateClass, onManageClass, releases }) {
  const [status, setStatus] = useState('active')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState({ code: '', status: '' })
  const [visibleCodes, setVisibleCodes] = useState(() => new Set())
  const visibleClasses = useMemo(() => classes.filter((item) => (
    (status === 'archived' ? Boolean(item.archived_at) : !item.archived_at)
    && `${item.name} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [classes, query, status])

  async function copyClassCode(code) {
    const copied = await copyText(code)
    setCopyFeedback({ code, status: copied ? 'copied' : 'error' })
    window.setTimeout(() => setCopyFeedback((current) => current.code === code ? { code: '', status: '' } : current), 1800)
  }

  function toggleClassCode(classId) {
    setVisibleCodes((current) => {
      const next = new Set(current)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }

  return (
    <section className="faculty-classes-page">
      <div className="faculty-page-heading"><div><nav><span>Faculty</span><span>›</span><span>Classes</span></nav><h1>Classes</h1></div><button className="faculty-primary-action" onClick={() => setCreateOpen(true)} type="button"><span>＋</span> New Class</button></div>
      <div className="faculty-class-tools">
        <div className="faculty-class-tabs">
          {['active', 'archived'].map((item) => { const count = classes.filter((entry) => item === 'archived' ? entry.archived_at : !entry.archived_at).length; return <button className={status === item ? 'active' : ''} key={item} onClick={() => setStatus(item)} type="button">{item === 'active' ? 'Active' : 'Archived'} <span>{count}</span></button> })}
        </div>
        <label className="faculty-search"><SmallIcon name="search" /><input aria-label="Search classes" onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or code..." type="search" value={query} /></label>
      </div>
      <div className="faculty-class-table-wrap">
        <table className="faculty-class-table"><thead><tr><th>Class</th><th>Code</th><th>Students</th><th>Assessments</th><th>Completion</th><th>Last Activity</th><th aria-label="Actions" /></tr></thead><tbody>
          {visibleClasses.map((item) => {
            const students = enrollments.filter((entry) => entry.class_id === item.id && entry.status === 'active')
            const activeStudentIds = new Set(students.map((entry) => entry.student_id))
            const classReleases = releases.filter((entry) => entry.class_id === item.id)
            const expected = students.length * classReleases.length
            const activeAttempts = attempts.filter((entry) => entry.class_id === item.id && activeStudentIds.has(entry.student_id))
            const submitted = activeAttempts.filter((entry) => entry.status === 'submitted').length
            const completion = expected ? Math.min(100, Math.round((submitted / expected) * 100)) : 0
            const lastActivity = activeAttempts.map((entry) => entry.submitted_at || entry.started_at).filter(Boolean).sort().at(-1)
            const feedback = copyFeedback.code === item.code ? copyFeedback.status : ''
            const codeVisible = visibleCodes.has(item.id)
            return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.archived_at ? 'Archived class' : 'Active class'}</small></td><td><div className="faculty-code-controls"><button aria-label={`Copy class code for ${item.name}`} className={`faculty-code-pill${feedback ? ` ${feedback}` : ''}`} onClick={() => copyClassCode(item.code)} title={feedback === 'copied' ? 'Copied!' : feedback === 'error' ? 'Copy failed' : 'Copy class code'} type="button"><SmallIcon name="copy" /> <span>{feedback === 'copied' ? 'Copied!' : feedback === 'error' ? 'Try again' : codeVisible ? item.code : '••••••••'}</span></button><button aria-label={`${codeVisible ? 'Hide' : 'Show'} class code for ${item.name}`} aria-pressed={codeVisible} className="faculty-code-visibility" onClick={() => toggleClassCode(item.id)} title={`${codeVisible ? 'Hide' : 'Show'} class code`} type="button"><SmallIcon name={codeVisible ? 'eyeOff' : 'eye'} /></button></div></td><td><span className="faculty-table-count"><SmallIcon name="students" /> {students.length}</span></td><td><span className="faculty-table-count"><SmallIcon name="assessment" /> {classReleases.length}</span></td><td><div className="faculty-completion"><i><span style={{ width: `${completion}%` }} /></i><span>{completion}%</span></div></td><td>{formatActivity(lastActivity)}</td><td><button className="faculty-manage-class" onClick={() => onManageClass(item.id)} type="button">Manage students <span aria-hidden="true">›</span></button></td></tr>
          })}
        </tbody></table>
        {!loading && visibleClasses.length === 0 && <p className="faculty-empty-state">No {status} classes match your search.</p>}
      </div>

      {createOpen && <div className="confirmation-backdrop" role="presentation"><section aria-labelledby="create-class-title" aria-modal="true" className="faculty-create-class-dialog" role="dialog"><header><div><h2 id="create-class-title">Create New Class</h2><p>Students join with the generated class code after creation.</p></div><button aria-label="Close create class dialog" onClick={() => setCreateOpen(false)} type="button">×</button></header><form onSubmit={async (event) => { if (await onCreateClass(event)) setCreateOpen(false) }}><label>Class Name<input autoFocus disabled={creating} maxLength="100" minLength="2" onChange={(event) => onClassNameChange(event.target.value)} placeholder="e.g. Introduction to Forensic Ballistics" required value={className} /></label><label>Semester / Term<input disabled readOnly value="Current term" /></label><p className="faculty-create-note">A unique class code will be generated automatically. You can share it with students after creating the class.</p><footer><button disabled={creating} onClick={() => setCreateOpen(false)} type="button">Cancel</button><button className="faculty-primary-action" disabled={creating} type="submit">{creating ? 'Creating...' : 'Create Class'}</button></footer></form></section></div>}
    </section>
  )
}
