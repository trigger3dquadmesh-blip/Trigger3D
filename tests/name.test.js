import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidFullName, normalizeFullName } from '../src/auth/name.js'

test('normalizes repeated whitespace in a student name', () => {
  assert.equal(normalizeFullName('  Maria   Dela Cruz  '), 'Maria Dela Cruz')
})

test('accepts human names without requiring uniqueness or a specific format', () => {
  assert.equal(isValidFullName('Juan Dela Cruz'), true)
  assert.equal(isValidFullName("Anne-Marie O'Neil"), true)
  assert.equal(isValidFullName('李明'), true)
})

test('rejects blank and non-name values', () => {
  assert.equal(isValidFullName(' '), false)
  assert.equal(isValidFullName('12345'), false)
})
