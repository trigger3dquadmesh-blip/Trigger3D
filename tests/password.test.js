import assert from 'node:assert/strict'
import test from 'node:test'
import { validateNewPassword, validatePasswordChange } from '../src/auth/password.js'

test('requires strong passwords for new credentials', () => {
  assert.equal(validateNewPassword('short'), 'Your password must contain at least 12 characters.')
  assert.equal(validateNewPassword('lowercaseonly!1'), 'Your password must include an uppercase letter.')
  assert.equal(validateNewPassword('UPPERCASEONLY!1'), 'Your password must include a lowercase letter.')
  assert.equal(validateNewPassword('NoNumberSymbol!'), 'Your password must include a number.')
  assert.equal(validateNewPassword('NoSymbol12345'), 'Your password must include a symbol.')
  assert.equal(validateNewPassword('SecurePass!123'), '')
})

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
  }), 'Your new password must contain at least 12 characters.')

  assert.equal(validatePasswordChange({
    currentPassword: 'SamePassword!123',
    newPassword: 'SamePassword!123',
    confirmPassword: 'SamePassword!123',
  }), 'Your new password must be different from your current password.')

  assert.equal(validatePasswordChange({
    currentPassword: 'old-password',
    newPassword: 'NewPassword!123',
    confirmPassword: 'DifferentPass!123',
  }), 'The new passwords do not match.')

  assert.equal(validatePasswordChange({
    currentPassword: 'old-password',
    newPassword: 'NewPassword!123',
    confirmPassword: 'NewPassword!123',
  }), '')
})
