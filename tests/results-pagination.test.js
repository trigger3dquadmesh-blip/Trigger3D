import test from 'node:test'
import assert from 'node:assert/strict'
import { getResultsPage } from '../src/features/faculty/results-pagination.js'

test('splits long faculty result lists into numbered pages', () => {
  const result = getResultsPage(Array.from({ length: 23 }, (_, index) => index + 1), 1, 10)

  assert.deepEqual(result, {
    items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    page: 1,
    pageCount: 3,
  })
})

test('keeps an out-of-range faculty result page within the available range', () => {
  const result = getResultsPage(['one', 'two'], 9, 10)

  assert.deepEqual(result, { items: ['one', 'two'], page: 0, pageCount: 1 })
})
