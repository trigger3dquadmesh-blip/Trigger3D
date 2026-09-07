import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuditReason } from '../src/features/admin/audit-log-reasons.js'

test('keeps an explicit Supabase audit reason', () => {
  assert.equal(getAuditReason({ reason: 'Faculty closed the assessment.' }), 'Faculty closed the assessment.')
})

test('describes a legacy archived event without inventing details', () => {
  assert.equal(
    getAuditReason({ event_type: 'Account archived', entity_type: 'profile', record_label: 'Student A' }),
    'Student A was archived while its existing records were preserved.',
  )
})

test('provides a truthful fallback for an unknown legacy event', () => {
  assert.equal(
    getAuditReason({ event_type: 'Maintenance event', entity_type: 'system', record_label: 'Trigger3D' }),
    'This system activity was recorded automatically; no additional reason was supplied.',
  )
})
