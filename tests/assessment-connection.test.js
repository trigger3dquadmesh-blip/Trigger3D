import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveConnectionRecovery } from '../src/features/student/assessment/assessment-connection.js'

test('distinguishes a faculty reset from recovery approval', () => {
  assert.equal(resolveConnectionRecovery({
    status: 'in_progress',
    timer_started_at: null,
    has_activity: false,
    integrity_locked_at: null,
    connection_interrupted_at: null,
  }, { connection_interrupted_at: null, connection_restored_at: null }), 'reset')

  assert.equal(resolveConnectionRecovery({
    status: 'in_progress',
    timer_started_at: '2026-11-08T09:00:00Z',
    has_activity: true,
    integrity_locked_at: null,
    connection_interrupted_at: null,
  }, {
    connection_interrupted_at: null,
    connection_restored_at: '2026-11-08T09:06:00Z',
  }), 'approved')
})

test('treats cleared interruption without restoration as a reset even when old activity remains', () => {
  assert.equal(resolveConnectionRecovery({
    status: 'in_progress',
    timer_started_at: '2026-11-08T09:00:00Z',
    has_activity: true,
    integrity_locked_at: null,
    connection_interrupted_at: null,
  }, {
    connection_interrupted_at: null,
    connection_restored_at: null,
  }), 'reset')
})

test('recognizes an older reset that left interruption metadata behind', () => {
  assert.equal(resolveConnectionRecovery({
    status: 'in_progress',
    timer_started_at: null,
    has_activity: false,
    integrity_locked_at: null,
    connection_interrupted_at: '2026-11-08T09:05:00Z',
  }, {
    connection_interrupted_at: '2026-11-08T09:05:00Z',
    connection_restored_at: null,
  }), 'reset')
})

test('keeps waiting while the interruption is still pending', () => {
  assert.equal(resolveConnectionRecovery({
    status: 'in_progress',
    timer_started_at: '2026-11-08T09:00:00Z',
    has_activity: true,
    integrity_locked_at: null,
    connection_interrupted_at: '2026-11-08T09:05:00Z',
  }, { connection_interrupted_at: '2026-11-08T09:05:00Z' }), 'waiting')
})
