import assert from 'node:assert/strict'
import test from 'node:test'
import { filterEnrollmentsByStudentQuery } from '../src/features/faculty/enrollment-search.js'

const enrollments = [
  { student: { full_name: 'Arian Jane Agdoro', email: 'arian@parsu.edu.ph' } },
  { student: { full_name: 'Stephanie Cea', email: 'stephanie@parsu.edu.ph' } },
]

test('filters enrolled students by name or email without changing the source list', () => {
  assert.deepEqual(
    filterEnrollmentsByStudentQuery(enrollments, 'arian'),
    [enrollments[0]],
  )
  assert.deepEqual(
    filterEnrollmentsByStudentQuery(enrollments, 'STEPHANIE@'),
    [enrollments[1]],
  )
  assert.equal(filterEnrollmentsByStudentQuery(enrollments, ''), enrollments)
})
