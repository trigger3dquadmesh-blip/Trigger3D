export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function isAllowedStudentEmail(email, domain) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedDomain = domain.trim().toLowerCase().replace(/^@/, '')

  return normalizedEmail.endsWith(`@${normalizedDomain}`)
}
