import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'
import { minimumDifficultySample, validSubmittedResultRows } from './component-difficulty.js'

function metric(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`
}

export default function FacultyClassAnalytics({ attempts, classItem, enrollments, firearms, releases, resultRows }) {
  const activeStudents = enrollments.filter((item) => item.status === 'active')
  const activeStudentIds = new Set(activeStudents.map((item) => item.student?.id || item.student_id))
  const activeAttempts = attempts.filter((item) => item.class_id === classItem.id && activeStudentIds.has(item.student_id))
  const submitted = activeAttempts.filter(assessmentAttemptIsSubmitted)
  const classReleases = releases.filter((item) => item.class_id === classItem.id)
  const assigned = activeStudents.length * classReleases.length
  const inProgress = activeAttempts.filter((item) => item.status === 'in_progress').length
  const completedRate = assigned ? Math.min(100, submitted.length / assigned * 100) : 0
  const inProgressRate = assigned ? Math.min(100 - completedRate, inProgress / assigned * 100) : 0
  const bands = [[90, 101, '90–100'], [80, 90, '80–89'], [70, 80, '70–79'], [60, 70, '60–69'], [0, 60, 'Below 60']].map(([min, max, label]) => ({ label, value: submitted.filter((item) => Number(item.percentage) >= min && Number(item.percentage) < max).length }))
  const maxBand = Math.max(1, ...bands.map((item) => item.value))
  const firearmScores = classReleases.map((release) => { const values = submitted.filter((item) => item.firearm_id === release.firearm_id); const firearm = firearms.find((item) => item.id === release.firearm_id); return { id: release.firearm_id, name: firearm?.name || 'Assessment', value: values.length ? values.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / values.length : 0, attempts: values.length } })
  const componentDifficulty = (() => {
    const map = new Map()
    validSubmittedResultRows(
      resultRows.filter((row) => row.class_id === classItem.id && activeStudentIds.has(row.student_id)),
      submitted,
    ).forEach((row) => {
      const key = `${row.firearm_name}:${row.component_name || 'Component'}`
      const item = map.get(key) || { name: (row.component_name || 'Component').replaceAll('_', ' '), incorrect: 0, total: 0, attemptIds: new Set() }
      item.total += 1
      if (!row.is_correct) item.incorrect += 1
      if (row.attempt_id) item.attemptIds.add(row.attempt_id)
      map.set(key, item)
    })
    return [...map.values()].map((item) => ({
      name: item.name,
      incorrect: item.incorrect,
      total: item.total,
      sampleSize: item.attemptIds.size,
      rate: item.total ? item.incorrect / item.total * 100 : 0,
    })).sort((a, b) => (
      b.rate - a.rate
      || b.sampleSize - a.sampleSize
      || b.total - a.total
      || a.name.localeCompare(b.name)
    ))
  })()
  const difficult = componentDifficulty.filter((item) => item.sampleSize >= minimumDifficultySample).slice(0, 5)
  const largestDifficultySample = Math.max(0, ...componentDifficulty.map((item) => item.sampleSize))

  return <div className="faculty-class-analytics-grid">
    <section className="faculty-reference-card"><header><div><h2>Score Distribution</h2><p>All attempts, this class</p></div></header><div className="faculty-class-score-bars">{bands.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.label} · ${item.value} ${item.value === 1 ? 'student' : 'students'}`} key={item.label} tabIndex="0"><div><i style={{ height: `${Math.max(item.value / maxBand * 100, item.value ? 7 : 0)}%` }} /></div><span>{item.label}</span></div>)}</div></section>
    <section className="faculty-reference-card"><header><div><h2>Completion Status</h2><p>All assigned assessments</p></div></header><div className="faculty-completion-donut-wrap"><div aria-label={`${metric(completedRate)} completed, ${metric(inProgressRate)} in progress`} className="faculty-chart-point faculty-completion-donut" data-tooltip={`${submitted.length} completed · ${inProgress} in progress · ${Math.max(0, assigned - submitted.length - inProgress)} not started`} role="img" style={{ background: `conic-gradient(#109d1a 0 ${completedRate}%, #ff9f0a ${completedRate}% ${completedRate + inProgressRate}%, var(--admin-muted-surface) ${completedRate + inProgressRate}% 100%)` }} tabIndex="0"><i /></div><p><span>● Completed</span><span>● In Progress</span><span>● Not Started</span></p></div></section>
    <section className="faculty-reference-card"><header><h2>Average Score per Assessment</h2></header><div className="faculty-class-score-bars">{firearmScores.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · ${metric(item.value)} average · ${item.attempts} attempts`} key={item.id} tabIndex="0"><div><i style={{ height: `${Math.max(item.value, item.value ? 7 : 0)}%` }} /></div><span>{item.name}</span></div>)}</div></section>
    <section className="faculty-reference-card"><header><div><h2>Most Difficult Components</h2><p>At least {minimumDifficultySample} submitted assessments</p></div></header><div className="faculty-class-difficult">{difficult.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.incorrect} incorrect of ${item.total} responses · ${item.sampleSize} submitted assessments`} key={item.name} tabIndex="0"><p><span>{item.name}</span><small>{metric(item.rate)}</small></p><i><b style={{ width: `${item.rate}%` }} /></i><small>{item.incorrect} of {item.total} responses incorrect · {item.sampleSize} submitted assessments</small></div>)}{componentDifficulty.length === 0 && <p className="faculty-empty-state">No submitted component responses yet.</p>}{componentDifficulty.length > 0 && difficult.length === 0 && <p className="faculty-empty-state">Not enough data for a reliable ranking. At least {minimumDifficultySample} submitted assessments per component are required; the current maximum is {largestDifficultySample}.</p>}</div></section>
  </div>
}
