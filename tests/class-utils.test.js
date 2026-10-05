import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterClasses,
  formatSemesterTerm,
  getDefaultAcademicYear,
  getClassTerms,
  isClassDeleteConfirmed,
  sortClassesByName,
} from '../src/features/faculty/class-utils.js'

test('requires the class code before permanent deletion', () => {
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'ab12cd34'), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', '  AB12CD34  '), true)
  assert.equal(isClassDeleteConfirmed('AB12CD34', 'AB12CD35'), false)
  assert.equal(isClassDeleteConfirmed('AB12CD34', null), false)
})

test('builds SIAS-style semester labels and academic years', () => {
  assert.equal(formatSemesterTerm('1st Semester', '2026-2027'), '2026-1')
  assert.equal(formatSemesterTerm('2nd Semester', '2026-2027'), '2026-2')
  assert.equal(getDefaultAcademicYear(new Date(2026, 7, 1)), '2026-2027')
  assert.equal(getDefaultAcademicYear(new Date(2026, 1, 1)), '2025-2026')
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

test('filters classes by active state, semester, and searchable term text', () => {
  const classes = [
    { name: 'BSCRIM 4A', code: 'A1', term: 'First Semester 2026-2027', archived_at: null },
    { name: 'BSCRIM 4B', code: 'B1', term: 'Second Semester 2026-2027', archived_at: null },
    { name: 'BSCRIM 3A', code: 'C1', term: 'First Semester 2025-2026', archived_at: '2026-05-01' },
  ]

  assert.deepEqual(
    filterClasses(classes, { term: 'First Semester 2026-2027' }).map((item) => item.code),
    ['A1'],
  )
  assert.deepEqual(filterClasses(classes, { query: 'second semester' }).map((item) => item.code), ['B1'])
  assert.deepEqual(filterClasses(classes, { status: 'archived' }).map((item) => item.code), ['C1'])
  assert.deepEqual(getClassTerms(classes), [
    'First Semester 2025-2026',
    'First Semester 2026-2027',
    'Second Semester 2026-2027',
  ])
})

test('places the newest historical class first and the oldest class last', () => {
  const classes = [
    { name: 'Old', code: 'OLD', term: '2024-1', end_date: '2024-05-01', archived_at: '2024-05-02' },
    { name: 'New', code: 'NEW', term: '2026-1', end_date: '2026-05-01', archived_at: '2026-05-02' },
  ]
  assert.deepEqual(filterClasses(classes, { status: 'archived' }).map((item) => item.code), ['NEW', 'OLD'])
})
