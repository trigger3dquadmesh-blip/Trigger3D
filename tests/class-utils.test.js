import test from 'node:test'
import assert from 'node:assert/strict'
import { isClassDeleteConfirmed } from '../src/features/faculty/class-utils.js'

test('requires the class code before permanent deletion', () => {
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'ab12cd34'), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', '  AB12CD34  '), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'AB12CD35'), false)
  assert.equal(isClassDeleteConfirmed('AB12CD34', null), false)
})
