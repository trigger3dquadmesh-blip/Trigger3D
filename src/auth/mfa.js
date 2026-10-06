export function normalizeMfaCode(value = '') {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function getVerifiedTotpFactors(factors) {
  return (factors?.totp || []).filter((factor) => factor.status === 'verified')
}

export function getMfaRequirement({ currentLevel, factors, role }) {
  if (!['admin', 'faculty'].includes(role)) return 'not-required'
  if (getVerifiedTotpFactors(factors).length === 0) return 'enrollment-required'
  return currentLevel === 'aal2' ? 'satisfied' : 'verification-required'
}

export function needsMfaVerification({ currentLevel, factors, role }) {
  return getMfaRequirement({ currentLevel, factors, role }) === 'verification-required'
}
