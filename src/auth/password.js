export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword) return 'Enter your current password.'
  if (newPassword.length < 8) return 'Your new password must contain at least 8 characters.'
  if (newPassword === currentPassword) return 'Your new password must be different from your current password.'
  if (newPassword !== confirmPassword) return 'The new passwords do not match.'
  return ''
}
