import assert from 'node:assert/strict'
import test from 'node:test'
import { isFirearmDeleteConfirmed } from '../src/features/admin/firearm-utils.js'

test('firearm deletion requires the full identifier', () => {
  assert.equal(isFirearmDeleteConfirmed('gun_a', ' GUN_A '), true)
  assert.equal(isFirearmDeleteConfirmed('gun_a', 'gun'), false)
  assert.equal(isFirearmDeleteConfirmed('gun_a', null), false)
})
