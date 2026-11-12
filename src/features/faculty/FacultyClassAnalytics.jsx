import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { buildClassAnalyticsData } from './class-analytics-data.js'
import { minimumDifficultySample, validSubmittedResultRows } from './component-difficulty.js'

function metric(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`
}

export default function FacultyClassAnalytics({ attempts, classItem, enrollments, firearms, releases, resultRows }) {
  const { activeStudentIds, submitted, classReleases, assigned, inProgress, locked, paused, notStarted } = buildClassAnalyticsData({ attempts, classId: classItem.id, enrollments, releases })
  const completionSegments = [
    { label: 'Completed', count: submitted.length, color: '#109d1a' },
    { label: 'In Progress', count: inProgress, color: '#ff9f0a' },
    { label: 'Locked', count: locked, color: '#dc2626' },
    { label: 'Paused', count: paused, color: '#7c3aed' },
    { label: 'Not Started', count: notStarted, color: '#94a3b8' },
  ]
  let segmentEnd = 0
  const completionGradient = completionSegments.map((segment) => {
    const start = segmentEnd
    segmentEnd += assigned ? segment.count / assigned * 100 : 0
    return `${segment.color} ${start}% ${segmentEnd}%`
  }).join(', ')
  const completionSummary = completionSegments.map((segment) => `${segment.count} ${segment.label.toLowerCase()}`).join(', ')
  const [liveResults, setLiveResults] = useState(null)
  const [resultsError, setResultsError] = useState('')
  const submissionKey = JSON.stringify(submitted.map((item) => [item.id, item.attempt_number, item.submitted_at]).sort())
  useEffect(() => {
    let active = true
    let pending = false
    async function refreshResults() {
      if (pending) return
      pending = true
      try {
        const { data, error } = await supabase.rpc('get_class_assessment_results', { target_class_id: classItem.id })
        if (!active) return
        if (error) throw error
        setLiveResults({ classId: classItem.id, rows: (data || []).map((row) => ({ ...row, class_id: classItem.id })) })
        setResultsError('')
      } catch {
        if (active) setResultsError('Component results could not refresh. Displayed results may be out of date; retrying automatically.')
      } finally {
        pending = false
      }
    }
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refreshResults()
    }
    void refreshResults()
    const poll = window.setInterval(refreshWhenVisible, 10000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(poll)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [classItem.id, submissionKey])
  const componentResultRows = liveResults?.classId === classItem.id ? liveResults.rows : resultRows
  const bands = [[90, 101, '90–100'], [80, 90, '80–89'], [70, 80, '70–79'], [60, 70, '60–69'], [0, 60, 'Below 60']].map(([min, max, label]) => ({ label, value: submitted.filter((item) => Number(item.percentage) >= min && Number(item.percentage) < max).length }))
  const maxBand = Math.max(1, ...bands.map((item) => item.value))
  const firearmScores = classReleases.map((release) => { const values = submitted.filter((item) => item.firearm_id === release.firearm_id); const firearm = firearms.find((item) => item.id === release.firearm_id); return { id: release.firearm_id, name: firearm?.name || 'Assessment', value: values.length ? values.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / values.length : 0, attempts: values.length } })
  const componentDifficulty = (() => {
    const map = new Map()
    validSubmittedResultRows(
      componentResultRows.filter((row) => row.class_id === classItem.id && activeStudentIds.has(row.student_id)),
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
    {resultsError && <p role="status">{resultsError}</p>}
    <section className="faculty-reference-card"><header><div><h2>Score Distribution</h2><p>Latest submitted attempt per student and assessment</p></div></header><div className="faculty-class-score-bars">{bands.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.label} · ${item.value} ${item.value === 1 ? 'submission' : 'submissions'}`} key={item.label} tabIndex="0"><div><i style={{ height: `${Math.max(item.value / maxBand * 100, item.value ? 7 : 0)}%` }} /></div><span>{item.label}</span></div>)}</div></section>
    <section className="faculty-reference-card"><header><div><h2>Completion Status</h2><p>All assigned assessments. Not Started is excluded from scores.</p></div></header><div className="faculty-completion-donut-wrap">{assigned ? <><div aria-label={completionSummary} className="faculty-chart-point faculty-completion-donut" data-tooltip={completionSummary} role="img" style={{ background: `conic-gradient(${completionGradient})` }} tabIndex="0"><i /></div><p>{completionSegments.map((segment) => <span key={segment.label} style={{ color: segment.color }}>● {segment.label} ({segment.count})</span>)}</p></> : <p>No assigned assessments yet.</p>}</div></section>
    <section className="faculty-reference-card"><header><h2>Average Score per Assessment</h2></header><div className="faculty-class-score-bars">{firearmScores.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.name} · ${metric(item.value)} average · ${item.attempts} attempts`} key={item.id} tabIndex="0"><div><i style={{ height: `${Math.max(item.value, item.value ? 7 : 0)}%` }} /></div><span>{item.name}</span></div>)}</div></section>
    <section className="faculty-reference-card"><header><div><h2>Most Difficult Components</h2><p>At least {minimumDifficultySample} submitted assessments</p></div></header><div className="faculty-class-difficult">{difficult.map((item) => <div className="faculty-chart-point" data-tooltip={`${item.incorrect} incorrect of ${item.total} responses · ${item.sampleSize} submitted assessments`} key={item.name} tabIndex="0"><p><span>{item.name}</span><small>{metric(item.rate)}</small></p><i><b style={{ width: `${item.rate}%` }} /></i><small>{item.incorrect} of {item.total} responses incorrect · {item.sampleSize} submitted assessments</small></div>)}{componentDifficulty.length === 0 && <p className="faculty-empty-state">No submitted component responses yet.</p>}{componentDifficulty.length > 0 && difficult.length === 0 && <p className="faculty-empty-state">Not enough data for a reliable ranking. At least {minimumDifficultySample} submitted assessments per component are required; the current maximum is {largestDifficultySample}.</p>}</div></section>
  </div>
}
