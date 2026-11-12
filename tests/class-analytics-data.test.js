import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClassAnalyticsData } from '../src/features/faculty/class-analytics-data.js'

const base = {
  classId: 'class',
  enrollments: ['a', 'b', 'c'].map((student_id) => ({ class_id: 'class', student_id, status: 'active' })),
  releases: [{ class_id: 'class', firearm_id: 'gun' }],
}
function attempt(id, student_id, fields = {}) {
  return { id, student_id, class_id: 'class', firearm_id: 'gun', attempt_number: 1, status: 'in_progress', has_activity: false, ...fields }
}

test('reset and untouched attempts count as not started, including stale lock markers', () => {
  const result = buildClassAnalyticsData({ ...base, attempts: [
    attempt('a', 'a'), attempt('b', 'b', { integrity_locked_at: 'old' }),
    attempt('c', 'c', { connection_interrupted_at: 'old' }),
  ] })
  assert.equal(result.notStarted, 3)
  assert.equal(result.inProgress, 0)
  assert.equal(result.inProgressRate, 0)
})

test('a retake replaces the historical score in every chart source', () => {
  const result = buildClassAnalyticsData({ ...base, attempts: [
    attempt('old', 'a', { status: 'submitted', has_activity: true, percentage: 100 }),
    attempt('reset', 'a', { attempt_number: 2 }),
    attempt('b', 'b', { status: 'submitted', has_activity: true, percentage: 70 }),
    attempt('c', 'c', { timer_started_at: 'now', connection_interrupted_at: 'now' }),
  ] })
  assert.deepEqual(result.submitted.map((item) => item.id), ['b'])
  assert.equal(result.inProgress, 0)
  assert.equal(result.paused, 1)
  assert.equal(result.notStarted, 1)
  assert.equal(result.assigned, 3)
})

test('only active students and assigned assessments in this class contribute', () => {
  const result = buildClassAnalyticsData({ ...base, enrollments: [...base.enrollments,
    { student_id: 'removed', status: 'removed' }, { student_id: 'other', class_id: 'other', status: 'active' },
  ], attempts: [
    attempt('removed', 'removed', { has_activity: true }),
    attempt('other-class', 'a', { class_id: 'other', has_activity: true }),
    attempt('unassigned', 'a', { firearm_id: 'unassigned', has_activity: true }),
  ] })
  assert.equal(result.assigned, 3)
  assert.equal(result.inProgress, 0)
  assert.equal(result.notStarted, 3)
})

test('counts a completed retake once and handles no assignments', () => {
  const rows = [1, 2].map((attempt_number) => attempt(String(attempt_number), 'a', { attempt_number, status: 'submitted', has_activity: true, percentage: attempt_number * 40 }))
  const result = buildClassAnalyticsData({ ...base, attempts: rows })
  assert.deepEqual(result.submitted.map((item) => item.percentage), [80])
  const empty = buildClassAnalyticsData({ ...base, releases: [], attempts: rows })
  assert.equal(empty.assigned, 0)
  assert.equal(empty.completedRate, 0)
  assert.equal(empty.notStarted, 0)
})

test('fullscreen exit moves an answering attempt from in progress to locked', () => {
  const answering = attempt('a', 'a', { timer_started_at: 'now', has_activity: true })
  const before = buildClassAnalyticsData({ ...base, attempts: [answering] })
  assert.equal(before.inProgress, 1)
  const after = buildClassAnalyticsData({ ...base, attempts: [{ ...answering, integrity_locked_at: 'now', integrity_lock_reason: 'fullscreen_exited' }] })
  assert.equal(after.inProgress, 0)
  assert.equal(after.locked, 1)
  assert.equal(after.notStarted, 2)
  assert.equal(after.submitted.length, 0)
})

test('completion categories are exclusive and sum to all assignments', () => {
  const result = buildClassAnalyticsData({ ...base, enrollments: ['a', 'b', 'c', 'd', 'e'].map((student_id) => ({ student_id, status: 'active' })), attempts: [
    attempt('a', 'a', { status: 'submitted', has_activity: true }),
    attempt('b', 'b', { has_activity: true }),
    attempt('c', 'c', { has_activity: true, integrity_locked_at: 'now' }),
    attempt('d', 'd', { has_activity: true, connection_interrupted_at: 'now' }),
  ] })
  assert.deepEqual([result.submitted.length, result.inProgress, result.locked, result.paused, result.notStarted], [1, 1, 1, 1, 1])
  assert.equal(result.assigned, 5)
})
