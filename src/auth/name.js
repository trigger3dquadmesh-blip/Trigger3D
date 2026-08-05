export function normalizeFullName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function isValidFullName(value) {
  const normalized = normalizeFullName(value)
  return normalized.length >= 2
    && normalized.length <= 100
    && /\p{L}/u.test(normalized)
}
