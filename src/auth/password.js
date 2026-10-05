export const minimumPasswordLength = 12

export function validateNewPassword(password) {
  if (password.length < minimumPasswordLength) {
    return `Your password must contain at least ${minimumPasswordLength} characters.`
  }
  if (!/[a-z]/.test(password)) return 'Your password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Your password must include an uppercase letter.'
  if (!/\d/.test(password)) return 'Your password must include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Your password must include a symbol.'
  return ''
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword) return 'Enter your current password.'
  const passwordError = validateNewPassword(newPassword)
  if (passwordError) return passwordError.replace('Your password', 'Your new password')
  if (newPassword === currentPassword) return 'Your new password must be different from your current password.'
  if (newPassword !== confirmPassword) return 'The new passwords do not match.'
  return ''
}
