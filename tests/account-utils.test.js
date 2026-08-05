import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accountMatchesSearch,
  getAccountRelationship,
  isAccountDeleteConfirmed,
} from '../src/features/admin/accounts/account-utils.js'

const account = {
  id: 'faculty-1',
  email: 'faculty@parsu.edu.ph',
  full_name: 'Faculty One',
  role: 'faculty',
}

test('account search matches names, email addresses, and roles case-insensitively', () => {
  assert.equal(accountMatchesSearch(account, 'FACULTY ONE'), true)
  assert.equal(accountMatchesSearch(account, '@parsu.edu.ph'), true)
  assert.equal(accountMatchesSearch(account, 'student'), false)
})

test('delete confirmation requires the complete email but ignores case and spaces', () => {
  assert.equal(isAccountDeleteConfirmed(account.email, ' Faculty@Parsu.edu.ph '), true)
  assert.equal(isAccountDeleteConfirmed(account.email, 'faculty'), false)
  assert.equal(isAccountDeleteConfirmed(account.email, null), false)
})

test('account relationships summarize assigned classes and enrollment', () => {
  const classes = [
    { faculty_id: account.id, archived_at: null },
    { faculty_id: account.id, archived_at: '2026-08-04' },
  ]
  assert.equal(getAccountRelationship(account, classes, []), '2 classes (1 active)')

  assert.equal(
    getAccountRelationship(
      { id: 'student-1', role: 'student' },
      [],
      [{ student_id: 'student-1', status: 'active', class: { name: 'Class A', code: 'ABC123' } }],
    ),
    'Class A (ABC123)',
  )
})
