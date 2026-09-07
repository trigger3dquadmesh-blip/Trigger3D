import assert from 'node:assert/strict'
import test from 'node:test'
import { getViewedFirearmKey, hasViewedFirearm, markFirearmViewed } from '../src/features/student/viewer/viewed-firearms.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('tracks firearm views separately for every student and class', () => {
  const storage = memoryStorage()
  markFirearmViewed(storage, 'student-a', 'class-a', 'firearm-a')

  assert.equal(hasViewedFirearm(storage, 'student-a', 'class-a', 'firearm-a'), true)
  assert.equal(hasViewedFirearm(storage, 'student-b', 'class-a', 'firearm-a'), false)
  assert.equal(hasViewedFirearm(storage, 'student-a', 'class-b', 'firearm-a'), false)
  assert.match(storage.getItem(getViewedFirearmKey('student-a', 'class-a', 'firearm-a')), /^\d{4}-\d{2}-\d{2}T/)
})
