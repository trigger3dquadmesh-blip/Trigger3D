import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedStudentEmail, normalizeEmail } from '../src/auth/email.js'
import { getRoleHomePath, ROLES } from '../src/config/roles.js'

test('normalizes whitespace and capitalization', () => {
  assert.equal(normalizeEmail(' Student@Parsu.edu.ph '), 'student@parsu.edu.ph')
})

test('accepts the exact PARSU email domain', () => {
  assert.equal(isAllowedStudentEmail('student@parsu.edu.ph', 'parsu.edu.ph'), true)
})

test('rejects lookalike and subdomain addresses', () => {
  assert.equal(isAllowedStudentEmail('student@fakeparsu.edu.ph', 'parsu.edu.ph'), false)
  assert.equal(isAllowedStudentEmail('student@dept.parsu.edu.ph', 'parsu.edu.ph'), false)
  assert.equal(isAllowedStudentEmail('parsu.edu.ph@gmail.com', 'parsu.edu.ph'), false)
})

test('maps each account role to its own dashboard', () => {
  assert.equal(getRoleHomePath(ROLES.ADMIN), '/admin')
  assert.equal(getRoleHomePath(ROLES.FACULTY), '/faculty')
  assert.equal(getRoleHomePath(ROLES.STUDENT), '/student')
  assert.equal(getRoleHomePath('unknown'), '/account')
})
