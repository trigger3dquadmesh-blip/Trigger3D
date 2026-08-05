import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePasswordChange } from '../src/auth/password.js'

test('validates current, new, and confirmation passwords', () => {
  assert.equal(validatePasswordChange({
    currentPassword: '',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  }), 'Enter your current password.')

  assert.equal(validatePasswordChange({
    currentPassword: 'old-password',
    newPassword: 'short',
    confirmPassword: 'short',
  }), 'Your new password must contain at least 8 characters.')

  assert.equal(validatePasswordChange({
    currentPassword: 'same-password',
    newPassword: 'same-password',
    confirmPassword: 'same-password',
  }), 'Your new password must be different from your current password.')

  assert.equal(validatePasswordChange({
    currentPassword: 'old-password',
    newPassword: 'new-password',
    confirmPassword: 'different-password',
  }), 'The new passwords do not match.')

  assert.equal(validatePasswordChange({
    currentPassword: 'old-password',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  }), '')
})
