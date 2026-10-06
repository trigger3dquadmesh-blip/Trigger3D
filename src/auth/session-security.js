export const privilegedIdleTimeoutMs = 30 * 60 * 1000

export function requiresPrivilegedIdleTimeout(role) {
  return role === 'admin' || role === 'faculty'
}

export function hasIdleSessionExpired(lastActivityAt, now = Date.now(), timeoutMs = privilegedIdleTimeoutMs) {
  return Number.isFinite(lastActivityAt) && lastActivityAt > 0 && now - lastActivityAt >= timeoutMs
}
