import { useState } from 'react'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'
import { minimumDifficultySample, validSubmittedResultRows } from './component-difficulty.js'

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0
}

function metric(value, suffix = '') {
  return Number.isInteger(value) ? `${value}${suffix}` : `${value.toFixed(1)}${suffix}`
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekDetails(value) {
  const date = new Date(value)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return { key: localDateKey(start), label: `${startLabel}–${endLabel}` }
}

export default function FacultyAnalyticsPanel({ attempts, classes, enrollments, hideClassPicker = false, initialClassId = 'all', loading, refreshing = false, releases, resultRows }) {
  const [classId, setClassId] = useState(initialClassId)
  const activeClasses = classes.filter((item) => !item.archived_at)
  const selectedClassId = classId === 'all' || activeClasses.some((item) => item.id === classId) ? classId : 'all'
  const scopedClassIds = new Set(selectedClassId === 'all' ? activeClasses.map((item) => item.id) : [selectedClassId])
  const scopedEnrollments = enrollments.filter((item) => item.status === 'active' && scopedClassIds.has(item.class_id))
  const scopedEnrollmentKeys = new Set(scopedEnrollments.map((item) => `${item.class_id}:${item.student_id}`))
  const scopedAttempts = attempts.filter((item) => assessmentAttemptIsSubmitted(item) && scopedEnrollmentKeys.has(`${item.class_id}:${item.student_id}`))
  const scopedRows = validSubmittedResultRows(
    resultRows.filter((item) => (
      scopedClassIds.has(item.class_id)
      && scopedEnrollmentKeys.has(`${item.class_id}:${item.student_id}`)
    )),
    scopedAttempts,
  )
  const scopedReleases = releases.filter((item) => scopedClassIds.has(item.class_id))
  const expected = scopedReleases.reduce((total, release) => total + scopedEnrollments.filter((item) => item.class_id === release.class_id).length, 0)
  const completion = expected ? Math.min(100, (scopedAttempts.length / expected) * 100) : 0
  const average = mean(scopedAttempts.map((item) => item.percentage))
  const passing = scopedAttempts.length ? (scopedAttempts.filter((item) => Number(item.percentage) >= 75).length / scopedAttempts.length) * 100 : 0

  const summaries = activeClasses.map((item) => {
    const students = enrollments.filter((entry) => entry.class_id === item.id && entry.status === 'active').length
    const activeStudentIds = new Set(enrollments.filter((entry) => entry.class_id === item.id && entry.status === 'active').map((entry) => entry.student_id))
    const classReleases = releases.filter((entry) => entry.class_id === item.id).length
    const classAttempts = attempts.filter((entry) => entry.class_id === item.id && assessmentAttemptIsSubmitted(entry) && activeStudentIds.has(entry.student_id))
    const classExpected = students * classReleases
    return { id: item.id, name: item.name, students, completion: classExpected ? Math.min(100, (classAttempts.length / classExpected) * 100) : 0, average: mean(classAttempts.map((entry) => entry.percentage)), passing: classAttempts.length ? (classAttempts.filter((entry) => Number(entry.percentage) >= 75).length / classAttempts.length) * 100 : 0 }
  }).filter((item) => selectedClassId === 'all' || item.id === selectedClassId)

  const componentDifficulty = (() => {
    const components = new Map()
    scopedRows.forEach((row) => {
      const key = `${row.firearm_name}:${row.component_name}`
      const current = components.get(key) || { name: row.component_name?.replaceAll('_', ' ') || 'Component', firearm: row.firearm_name || 'Firearm', total: 0, incorrect: 0, attemptIds: new Set() }
      current.total += 1
      if (!row.is_correct) current.incorrect += 1
      if (row.attempt_id) current.attemptIds.add(row.attempt_id)
      components.set(key, current)
    })
    return [...components.values()].map((item) => ({
      name: item.name,
      firearm: item.firearm,
      total: item.total,
      incorrect: item.incorrect,
      sampleSize: item.attemptIds.size,
      errorRate: item.total ? (item.incorrect / item.total) * 100 : 0,
    })).sort((a, b) => (
      b.errorRate - a.errorRate
      || b.sampleSize - a.sampleSize
      || b.total - a.total
      || a.name.localeCompare(b.name)
    ))
  })()
  const difficultComponents = componentDifficulty
    .filter((item) => item.sampleSize >= minimumDifficultySample)
    .slice(0, 6)
  const largestDifficultySample = Math.max(0, ...componentDifficulty.map((item) => item.sampleSize))

  const weekly = (() => {
    const sorted = [...scopedAttempts].sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
    if (!sorted.length) return []
    const buckets = new Map()
    sorted.forEach((attempt) => {
      const week = weekDetails(attempt.submitted_at || attempt.started_at)
      const current = buckets.get(week.key) || { label: week.label, values: [] }
      current.values.push(Number(attempt.percentage || 0))
      buckets.set(week.key, current)
    })
    return [...buckets.values()].slice(-8).map((item) => ({ label: item.label, value: mean(item.values), submissions: item.values.length }))
  })()

  const linePoints = weekly.map((item, index) => `${weekly.length === 1 ? 50 : (index / (weekly.length - 1)) * 100},${100 - Math.max(0, Math.min(100, item.value))}`).join(' ')
  const latestWeek = weekly.at(-1)
  const previousWeek = weekly.at(-2)
  const weeklyChange = latestWeek && previousWeek ? latestWeek.value - previousWeek.value : 0
  const trendDirection = Math.abs(weeklyChange) < 0.05 ? 'stayed the same' : weeklyChange > 0 ? 'improved' : 'declined'
  const metrics = [
    ['Active Classes', summaries.length],
    ['Unique Students', new Set(scopedEnrollments.map((item) => item.student_id)).size],
    ['Completion Rate', metric(completion, '%')],
    ['Average Score', metric(average, '%')],
    ['Passing Rate', metric(passing, '%')],
  ]

  if (loading) return <section className="faculty-analytics-page"><DashboardLoading label="Loading results…" /></section>

  return <section className="faculty-analytics-page">
    <div className="faculty-page-heading"><div><nav><span>Faculty</span><span>›</span><span>Analytics</span></nav><h1>Analytics</h1>{refreshing && <small aria-live="polite" role="status">Updating analytics…</small>}</div>{!hideClassPicker && <label className="faculty-analytics-picker"><span className="faculty-sr-only">Choose analytics scope</span><select aria-label="Analytics class" onChange={(event) => setClassId(event.target.value)} value={selectedClassId}><option value="all">Overall Summary</option>{activeClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    <div className="faculty-analytics-metrics">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{loading ? 'Loading…' : value}</strong></article>)}</div>
    <div className="faculty-analytics-grid">
      <section className="faculty-reference-card"><header><h2>Average Score per Class</h2></header><div className="faculty-class-bar-chart">{summaries.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · Average score ${metric(item.average, '%')} · ${item.students} students`} key={item.id} tabIndex="0"><div><i style={{ height: `${Math.max(item.average, item.average ? 6 : 0)}%` }} /></div><span>{item.name}</span><small>{metric(item.average, '%')}</small></div>)}</div></section>
      <section className="faculty-reference-card"><header><h2>Completion Status per Class</h2></header><div className="faculty-class-bar-chart stacked">{summaries.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · ${metric(item.completion, '%')} completed · ${metric(100 - item.completion, '%')} incomplete`} key={item.id} tabIndex="0"><div><i style={{ height: `${item.completion}%` }} /><b style={{ height: `${100 - item.completion}%` }} /></div><span>{item.name}</span><small>{metric(item.completion, '%')}</small></div>)}</div><p className="faculty-chart-legend"><span>● Completed</span><span>● Incomplete</span></p></section>
      <section className="faculty-reference-card faculty-wide-card"><header><div><h2>Performance Over Time</h2><p>Weekly average score for the selected class scope</p></div></header>{weekly.length >= 2 ? <div className="faculty-performance-content"><div className={`faculty-performance-summary ${weeklyChange > 0 ? 'improved' : weeklyChange < 0 ? 'declined' : ''}`}><strong>Performance {trendDirection}</strong><span>{trendDirection === 'stayed the same' ? `The weekly average remains ${metric(latestWeek.value, '%')}.` : `${metric(Math.abs(weeklyChange), '%')} ${weeklyChange > 0 ? 'higher' : 'lower'} than the previous week.`}</span></div><div className="faculty-line-chart"><svg aria-label="Weekly average score trend" preserveAspectRatio="none" role="img" viewBox="0 0 100 100"><polyline points={linePoints} /><g>{weekly.map((item, index) => <circle cx={(index / (weekly.length - 1)) * 100} cy={100 - Math.max(0, Math.min(100, item.value))} key={item.label} r="1.8"><title>{item.label}: {metric(item.value, '%')} average from {item.submissions} submitted {item.submissions === 1 ? 'assessment' : 'assessments'}</title></circle>)}</g></svg><div className="faculty-line-chart-labels">{weekly.map((item) => <span key={item.label}>{item.label}</span>)}</div></div><div className="faculty-performance-weeks">{weekly.map((item) => <article key={item.label}><span>{item.label}</span><strong>{metric(item.value, '%')}</strong><small>{item.submissions} submitted {item.submissions === 1 ? 'assessment' : 'assessments'}</small></article>)}</div></div> : weekly.length === 1 ? <div className="faculty-performance-insufficient"><strong>Not enough data to show a trend yet</strong><p>A trend requires submitted assessments from at least two different weeks.</p><span>{latestWeek.label}: {metric(latestWeek.value, '%')} average from {latestWeek.submissions} submitted {latestWeek.submissions === 1 ? 'assessment' : 'assessments'}.</span></div> : <p className="faculty-empty-state">No submitted assessments yet. Weekly performance will appear after students complete assessments.</p>}</section>
      <section className="faculty-reference-card faculty-wide-card"><header><div><h2>Most Difficult Components</h2><p>Ranked by error rate after at least {minimumDifficultySample} submitted assessments per component</p></div></header><div className="faculty-difficult-list">{difficultComponents.map((item, index) => <article className="faculty-chart-point" data-tooltip={`${item.name} · ${item.incorrect} incorrect of ${item.total} responses · ${item.sampleSize} submitted assessments · ${metric(item.errorRate, '%')} error rate`} key={`${item.firearm}:${item.name}`} tabIndex="0"><span>{index + 1}</span><div><div><strong>{item.name}</strong><small>{metric(item.errorRate, '%')}</small></div><i><b style={{ width: `${item.errorRate}%` }} /></i><small>{item.firearm} · {item.incorrect} of {item.total} responses incorrect · {item.sampleSize} submitted assessments</small></div></article>)}</div>{!loading && componentDifficulty.length === 0 && <p className="faculty-empty-state">No submitted component responses yet.</p>}{!loading && componentDifficulty.length > 0 && difficultComponents.length === 0 && <p className="faculty-empty-state">Not enough data for a reliable ranking. At least {minimumDifficultySample} submitted assessments per component are required; the current maximum is {largestDifficultySample}.</p>}</section>
      <section className="faculty-reference-card faculty-wide-card"><header><h2>Class Summary</h2></header><div className="faculty-summary-table-wrap"><table className="faculty-summary-table"><thead><tr><th>Class</th><th>Students</th><th>Completion</th><th>Avg Score</th><th>Passing Rate</th><th>Status</th></tr></thead><tbody>{summaries.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.students}</td><td><div className="faculty-completion"><i><span style={{ width: `${item.completion}%` }} /></i><span>{metric(item.completion, '%')}</span></div></td><td>{metric(item.average, '%')}</td><td>{metric(item.passing, '%')}</td><td><span className="faculty-active-pill">Active</span></td></tr>)}</tbody></table></div></section>
    </div>
  </section>
}
