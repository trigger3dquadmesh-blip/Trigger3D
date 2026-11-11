import test from 'node:test'
import assert from 'node:assert/strict'
import { validSubmittedResultRows } from '../src/features/faculty/component-difficulty.js'

function submittedAttempt(id) {
  return { id, status: 'submitted', has_activity: true }
}

test('removes saved result rows after an assessment attempt is reset', () => {
  const rows = [
    { attempt_id: 'reset-attempt', component_name: 'Barrel' },
    { attempt_id: 'submitted-attempt', component_name: 'Slide' },
  ]
  const attempts = [
    { id: 'reset-attempt', status: 'not_started', has_activity: false },
    submittedAttempt('submitted-attempt'),
  ]

  assert.deepEqual(validSubmittedResultRows(rows, attempts), [rows[1]])
})

test('keeps no component results when there are no valid submissions', () => {
  const rows = [
    { attempt_id: 'old-one', component_name: 'Barrel' },
    { attempt_id: 'old-two', component_name: 'Slide' },
    { attempt_id: 'old-three', component_name: 'Hammer' },
  ]
  const attempts = rows.map((row) => ({
    id: row.attempt_id,
    status: 'not_started',
    has_activity: false,
  }))

  assert.deepEqual(validSubmittedResultRows(rows, attempts), [])
})

test('ignores result rows that are not tied to a current submitted attempt', () => {
  const rows = [
    { attempt_id: null, component_name: 'Barrel' },
    { attempt_id: 'unknown', component_name: 'Slide' },
  ]

  assert.deepEqual(validSubmittedResultRows(rows, [submittedAttempt('current')]), [])
})
