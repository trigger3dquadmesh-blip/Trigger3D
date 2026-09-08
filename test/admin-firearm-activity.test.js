import assert from 'node:assert/strict'
import test from 'node:test'
import { getRecentFirearmEvents } from '../src/features/admin/admin-overview-utils.js'

test('removes stale upload activity after a firearm is deleted', () => {
  const events = [
    { id: 'old', entity_id: 'deleted-firearm', entity_type: 'firearm', event_type: 'Firearm uploaded' },
    { id: 'live', entity_id: 'active-firearm', entity_type: 'firearm', event_type: 'Firearm uploaded' },
  ]

  assert.deepEqual(getRecentFirearmEvents(events, [{ id: 'active-firearm' }]).map((event) => event.id), ['live'])
})

test('shows the deletion as the latest activity without repeating its upload', () => {
  const events = [
    { id: 'deleted', entity_id: 'firearm-1', entity_type: 'firearm', event_type: 'Firearm deleted' },
    { id: 'uploaded', entity_id: 'firearm-1', entity_type: 'firearm', event_type: 'Firearm uploaded' },
  ]

  assert.deepEqual(getRecentFirearmEvents(events, []).map((event) => event.id), ['deleted'])
})
