export function normalizeMfaCode(value = '') {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function getVerifiedTotpFactors(factors) {
  return (factors?.totp || []).filter((factor) => factor.status === 'verified')
}

export function needsMfaVerification({ currentLevel, factors, role }) {
  return ['admin', 'faculty'].includes(role)
    && getVerifiedTotpFactors(factors).length > 0
    && currentLevel !== 'aal2'
}
