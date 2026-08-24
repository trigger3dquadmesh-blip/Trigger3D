import { useMemo, useState } from 'react'
import { buildProgressAnalytics } from './progress-analytics.js'

export default function ProgressGraphAnalytics({ attempts, questionAnalytics, studentName = '' }) {
  const [chartType, setChartType] = useState('bar')
  const [metric, setMetric] = useState('answers')
  const analytics = useMemo(
    () => buildProgressAnalytics(attempts, questionAnalytics),
    [attempts, questionAnalytics],
  )
  const chartData = metric === 'answers' ? analytics.answerSummary : analytics.scoreDistribution
  const chartLabel = metric === 'answers' ? 'Recorded answers' : 'Submitted attempts'

  return (
    <section className="progress-graph-analytics" aria-labelledby="progress-graph-title">
      <div className="progress-graph-heading">
        <div>
          <p className="eyebrow">Progress Recording</p>
          <h3 id="progress-graph-title">{studentName ? `${studentName}'s graph analytics` : 'Graph analytics'}</h3>
          <p>{studentName
            ? 'This summary shows this student’s answers and assessment score.'
            : 'See how students answered and how scores are distributed in this class.'}</p>
        </div>
        <div className="progress-graph-controls">
          <label>
            Show
            <select value={metric} onChange={(event) => setMetric(event.target.value)}>
              <option value="answers">Answer accuracy</option>
              <option value="scores">Student score distribution</option>
            </select>
          </label>
          <label>
            Graph
            <select value={chartType} onChange={(event) => setChartType(event.target.value)}>
              <option value="bar">Bar chart</option>
              <option value="donut">Donut chart</option>
            </select>
          </label>
        </div>
      </div>

      <div className="progress-graph-metrics">
        <Metric label="Submitted attempts" value={analytics.totalAttempts} />
        <Metric label="Recorded answers" value={analytics.totalAnswers} />
        <Metric label="Average score" value={`${analytics.averageScore.toFixed(1)}%`} />
      </div>

      <div className="progress-graph-chart" aria-label={`${chartLabel} graph`}>
        {chartType === 'bar' ? <BarChart data={chartData} /> : <DonutChart data={chartData} label={chartLabel} />}
      </div>
    </section>
  )
}

function Metric({ label, value }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function BarChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const maximum = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="progress-bar-chart">
      {data.map((item) => {
        const percentage = total ? (item.value / total) * 100 : 0
        return (
          <div className="progress-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="progress-bar-track">
              <div style={{ background: item.color, width: `${(item.value / maximum) * 100}%` }} />
            </div>
            <strong>{item.value} <small>({percentage.toFixed(1)}%)</small></strong>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data, label }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  const gradient = total ? data.map((item) => {
    const start = (offset / total) * 100
    offset += item.value
    const end = (offset / total) * 100
    return `${item.color} ${start}% ${end}%`
  }).join(', ') : 'var(--border) 0 100%'

  return (
    <div className="progress-donut-chart">
      <div className="progress-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div><strong>{total}</strong><span>{label}</span></div>
      </div>
      <div className="progress-donut-legend">
        {data.map((item) => (
          <div key={item.label}>
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
