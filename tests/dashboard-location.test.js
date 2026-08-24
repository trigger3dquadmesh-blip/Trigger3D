import assert from 'node:assert/strict'
import test from 'node:test'
import { getSavedDashboardPage, saveDashboardPage } from '../src/components/dashboard-location.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('restores the last valid dashboard panel', () => {
  const storage = createStorage()
  const pages = ['overview', 'accounts', 'firearms']

  saveDashboardPage(storage, 'trigger3d.admin.panel', 'accounts')

  assert.equal(
    getSavedDashboardPage(storage, 'trigger3d.admin.panel', pages, 'overview'),
    'accounts',
  )
})

test('uses the default panel when stored data is missing or no longer valid', () => {
  const storage = createStorage()
  storage.setItem('trigger3d.student.panel', 'accounts')

  assert.equal(
    getSavedDashboardPage(storage, 'trigger3d.student.panel', ['overview', 'results'], 'overview'),
    'overview',
  )
})
