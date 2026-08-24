import assert from 'node:assert/strict'
import test from 'node:test'
import { getStudentGreeting } from './student-greeting.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('welcomes a student on the first visit and welcomes them back afterwards', () => {
  const storage = createStorage()
  const profile = { id: 'student-1', full_name: 'Arian Jane' }

  assert.equal(getStudentGreeting(profile, storage), 'Welcome, Arian Jane.')
  assert.equal(getStudentGreeting(profile, storage), 'Welcome back, Arian Jane.')
})

test('keeps visit history separate for each student', () => {
  const storage = createStorage()

  getStudentGreeting({ id: 'student-1', full_name: 'Arian' }, storage)
  assert.equal(getStudentGreeting({ id: 'student-2', full_name: 'Jane' }, storage), 'Welcome, Jane.')
})
