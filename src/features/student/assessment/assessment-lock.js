const lockPrefix = 'trigger3d:assessment-lock:'

export function getAssessmentLockKey(firearmId) {
  return `${lockPrefix}${firearmId}`
}

export function setAssessmentLock(firearmId, locked) {
  try {
    const key = getAssessmentLockKey(firearmId)
    if (locked) localStorage.setItem(key, new Date().toISOString())
    else localStorage.removeItem(key)
  } catch {
    // The database remains authoritative if browser Storage is unavailable.
  }
}

export function getStudentFirearmDestination(firearmId, assessmentInProgress) {
  return assessmentInProgress
    ? `/student/models/${firearmId}/assessment`
    : `/student/models/${firearmId}`
}
