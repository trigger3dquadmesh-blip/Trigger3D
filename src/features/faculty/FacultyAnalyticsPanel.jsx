import { useState } from 'react'

function mean(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0
}

function metric(value, suffix = '') {
  return Number.isInteger(value) ? `${value}${suffix}` : `${value.toFixed(1)}${suffix}`
}

export default function FacultyAnalyticsPanel({ attempts, classes, enrollments, hideClassPicker = false, initialClassId = 'all', loading, releases, resultRows }) {
  const [classId, setClassId] = useState(initialClassId)
  const activeClasses = classes.filter((item) => !item.archived_at)
  const scopedClassIds = new Set(classId === 'all' ? activeClasses.map((item) => item.id) : [classId])
  const scopedEnrollments = enrollments.filter((item) => item.status === 'active' && scopedClassIds.has(item.class_id))
  const scopedAttempts = attempts.filter((item) => item.status === 'submitted' && scopedClassIds.has(item.class_id))
  const scopedRows = resultRows.filter((item) => scopedClassIds.has(item.class_id))
  const scopedReleases = releases.filter((item) => item.is_open && scopedClassIds.has(item.class_id))
  const expected = scopedReleases.reduce((total, release) => total + scopedEnrollments.filter((item) => item.class_id === release.class_id).length, 0)
  const completion = expected ? Math.min(100, (scopedAttempts.length / expected) * 100) : 0
  const average = mean(scopedAttempts.map((item) => item.percentage))
  const passing = scopedAttempts.length ? (scopedAttempts.filter((item) => Number(item.percentage) >= 75).length / scopedAttempts.length) * 100 : 0

  const summaries = activeClasses.map((item) => {
    const students = enrollments.filter((entry) => entry.class_id === item.id && entry.status === 'active').length
    const classReleases = releases.filter((entry) => entry.class_id === item.id && entry.is_open).length
    const classAttempts = attempts.filter((entry) => entry.class_id === item.id && entry.status === 'submitted')
    const classExpected = students * classReleases
    return { id: item.id, name: item.name, students, completion: classExpected ? Math.min(100, (classAttempts.length / classExpected) * 100) : 0, average: mean(classAttempts.map((entry) => entry.percentage)), passing: classAttempts.length ? (classAttempts.filter((entry) => Number(entry.percentage) >= 75).length / classAttempts.length) * 100 : 0 }
  }).filter((item) => classId === 'all' || item.id === classId)

  const difficultComponents = (() => {
    const components = new Map()
    scopedRows.forEach((row) => {
      const key = `${row.firearm_name}:${row.component_name}`
      const current = components.get(key) || { name: row.component_name?.replaceAll('_', ' ') || 'Component', firearm: row.firearm_name || 'Firearm', total: 0, incorrect: 0 }
      current.total += 1
      if (!row.is_correct) current.incorrect += 1
      components.set(key, current)
    })
    return [...components.values()].map((item) => ({ ...item, errorRate: item.total ? (item.incorrect / item.total) * 100 : 0 })).sort((a, b) => b.errorRate - a.errorRate).slice(0, 6)
  })()

  const weekly = (() => {
    const sorted = [...scopedAttempts].sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
    if (!sorted.length) return []
    const buckets = new Map()
    sorted.forEach((attempt) => {
      const date = new Date(attempt.submitted_at || attempt.started_at)
      const key = `${date.getFullYear()}-${date.getMonth()}-${Math.ceil(date.getDate() / 7)}`
      const current = buckets.get(key) || { label: date.toLocaleDateString('en', { month: 'short' }) + ` W${Math.ceil(date.getDate() / 7)}`, values: [] }
      current.values.push(Number(attempt.percentage || 0))
      buckets.set(key, current)
    })
    return [...buckets.values()].slice(-8).map((item) => ({ label: item.label, value: mean(item.values) }))
  })()

  const linePoints = weekly.map((item, index) => `${weekly.length === 1 ? 50 : (index / (weekly.length - 1)) * 100},${100 - Math.max(0, Math.min(100, item.value))}`).join(' ')
  const metrics = [
    ['Active Classes', summaries.length],
    ['Unique Students', new Set(scopedEnrollments.map((item) => item.student_id)).size],
    ['Completion Rate', metric(completion, '%')],
    ['Average Score', metric(average, '%')],
    ['Passing Rate', metric(passing, '%')],
  ]

  return <section className="faculty-analytics-page">
    <div className="faculty-page-heading"><div><nav><span>Faculty</span><span>›</span><span>Analytics</span></nav><h1>Analytics</h1></div>{!hideClassPicker && <label className="faculty-analytics-picker"><span className="faculty-sr-only">Choose analytics scope</span><select aria-label="Analytics class" onChange={(event) => setClassId(event.target.value)} value={classId}><option value="all">Overall Summary</option>{activeClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    <div className="faculty-analytics-metrics">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong></article>)}</div>
    <div className="faculty-analytics-grid">
      <section className="faculty-reference-card"><header><h2>Average Score per Class</h2></header><div className="faculty-class-bar-chart">{summaries.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · Average score ${metric(item.average, '%')} · ${item.students} students`} key={item.id} tabIndex="0"><div><i style={{ height: `${Math.max(item.average, item.average ? 6 : 0)}%` }} /></div><span>{item.name}</span><small>{metric(item.average, '%')}</small></div>)}</div></section>
      <section className="faculty-reference-card"><header><h2>Completion Status per Class</h2></header><div className="faculty-class-bar-chart stacked">{summaries.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · ${metric(item.completion, '%')} completed · ${metric(100 - item.completion, '%')} incomplete`} key={item.id} tabIndex="0"><div><i style={{ height: `${item.completion}%` }} /><b style={{ height: `${100 - item.completion}%` }} /></div><span>{item.name}</span><small>{metric(item.completion, '%')}</small></div>)}</div><p className="faculty-chart-legend"><span>● Completed</span><span>● Incomplete</span></p></section>
      <section className="faculty-reference-card faculty-wide-card"><header><div><h2>Performance Over Time</h2><p>Weekly average score across all classes</p></div></header>{weekly.length ? <div className="faculty-line-chart"><svg aria-label="Weekly average score" preserveAspectRatio="none" role="img" viewBox="0 0 100 100"><polyline points={linePoints} /><g>{weekly.map((item, index) => <circle cx={weekly.length === 1 ? 50 : (index / (weekly.length - 1)) * 100} cy={100 - Math.max(0, Math.min(100, item.value))} key={item.label} r="1.8"><title>{item.label}: {metric(item.value, '%')} average score</title></circle>)}</g></svg><div>{weekly.map((item) => <span key={item.label}>{item.label}</span>)}</div></div> : <p className="faculty-empty-state">No submitted assessments yet.</p>}</section>
      <section className="faculty-reference-card faculty-wide-card"><header><div><h2>Most Difficult Components</h2><p>Ranked by student error rate across all assessments</p></div></header><div className="faculty-difficult-list">{difficultComponents.map((item, index) => <article className="faculty-chart-point" data-tooltip={`${item.name} · ${item.incorrect} incorrect of ${item.total} responses · ${metric(item.errorRate, '%')} error rate`} key={`${item.firearm}:${item.name}`} tabIndex="0"><span>{index + 1}</span><div><div><strong>{item.name}</strong><small>{metric(item.errorRate, '%')}</small></div><i><b style={{ width: `${item.errorRate}%` }} /></i><small>{item.firearm}</small></div></article>)}</div>{!loading && difficultComponents.length === 0 && <p className="faculty-empty-state">No component response data yet.</p>}</section>
      <section className="faculty-reference-card faculty-wide-card"><header><h2>Class Summary</h2></header><div className="faculty-summary-table-wrap"><table className="faculty-summary-table"><thead><tr><th>Class</th><th>Students</th><th>Completion</th><th>Avg Score</th><th>Passing Rate</th><th>Status</th></tr></thead><tbody>{summaries.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.students}</td><td><div className="faculty-completion"><i><span style={{ width: `${item.completion}%` }} /></i><span>{metric(item.completion, '%')}</span></div></td><td>{metric(item.average, '%')}</td><td>{metric(item.passing, '%')}</td><td><span className="faculty-active-pill">Active</span></td></tr>)}</tbody></table></div></section>
    </div>
  </section>
}
