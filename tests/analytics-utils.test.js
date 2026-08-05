import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePerformance } from '../src/features/admin/analytics/analytics-utils.js'

test('summarizes assessment scores without imposing pass or fail labels', () => {
  const summary = summarizePerformance([0, 24, 25, 49, 50, 74, 75, 100])

  assert.equal(summary.total, 8)
  assert.equal(summary.average, 49.625)
  assert.deepEqual(summary.bands.map((band) => band.count), [2, 2, 2, 2])
})

test('returns an empty summary when there are no valid submitted scores', () => {
  const summary = summarizePerformance([null, undefined, 'not-a-score', -1, 101])

  assert.equal(summary.total, 0)
  assert.equal(summary.average, null)
  assert.deepEqual(summary.bands.map((band) => band.count), [0, 0, 0, 0])
})
