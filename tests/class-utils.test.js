import test from 'node:test'
import assert from 'node:assert/strict'
import { isClassDeleteConfirmed, sortClassesByName } from '../src/features/faculty/class-utils.js'

test('requires the class code before permanent deletion', () => {
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'ab12cd34'), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', '  AB12CD34  '), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'AB12CD35'), false)
  assert.equal(isClassDeleteConfirmed('AB12CD34', null), false)
})

test('sorts classes alphabetically by their section name', () => {
  const classes = [
    { name: 'BSCRIM - 4C' },
    { name: 'BSCRIM - 4B' },
    { name: 'BSCRIM - 4A' },
  ]

  assert.deepEqual(
    sortClassesByName(classes).map((item) => item.name),
    ['BSCRIM - 4A', 'BSCRIM - 4B', 'BSCRIM - 4C'],
  )
})
