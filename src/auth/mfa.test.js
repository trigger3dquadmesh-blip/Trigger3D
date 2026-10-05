import assert from 'node:assert/strict'
import test from 'node:test'
import { getVerifiedTotpFactors, needsMfaVerification, normalizeMfaCode } from './mfa.js'

test('normalizes an MFA code to six digits', () => {
  assert.equal(normalizeMfaCode('12a 34-567'), '123456')
})

test('returns only verified TOTP factors', () => {
  const factors = getVerifiedTotpFactors({
    totp: [
      { id: 'verified', status: 'verified' },
      { id: 'pending', status: 'unverified' },
    ],
  })
  assert.deepEqual(factors.map(({ id }) => id), ['verified'])
})

test('requires a second factor for admin and faculty accounts with enrolled TOTP below aal2', () => {
  const factors = { totp: [{ id: 'one', status: 'verified' }] }
  assert.equal(needsMfaVerification({ currentLevel: 'aal1', factors, role: 'admin' }), true)
  assert.equal(needsMfaVerification({ currentLevel: 'aal2', factors, role: 'admin' }), false)
  assert.equal(needsMfaVerification({ currentLevel: 'aal1', factors, role: 'faculty' }), true)
  assert.equal(needsMfaVerification({ currentLevel: 'aal2', factors, role: 'faculty' }), false)
  assert.equal(needsMfaVerification({ currentLevel: 'aal1', factors, role: 'student' }), false)
  assert.equal(needsMfaVerification({ currentLevel: 'aal1', factors: { totp: [] }, role: 'admin' }), false)
})
