import assert from 'node:assert/strict'
import test from 'node:test'
import { hasIdleSessionExpired, privilegedIdleTimeoutMs, requiresPrivilegedIdleTimeout } from '../src/auth/session-security.js'

test('applies idle expiration only to privileged roles', () => {
  assert.equal(requiresPrivilegedIdleTimeout('admin'), true)
  assert.equal(requiresPrivilegedIdleTimeout('faculty'), true)
  assert.equal(requiresPrivilegedIdleTimeout('student'), false)
})

test('expires a privileged session after the configured inactivity window', () => {
  const now = 2_000_000
  assert.equal(hasIdleSessionExpired(now - privilegedIdleTimeoutMs + 1, now), false)
  assert.equal(hasIdleSessionExpired(now - privilegedIdleTimeoutMs, now), true)
})
