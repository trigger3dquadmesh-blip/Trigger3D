export function isClassDeleteConfirmed(classCode, confirmation) {
  return typeof confirmation === 'string'
    && confirmation.trim().toUpperCase() === classCode
}
