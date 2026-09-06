const lockPrefix = 'trigger3d:assessment-lock:'

export function getAssessmentLockKey(firearmId, classId = '') {
  return classId
    ? `${lockPrefix}${classId}:${firearmId}`
    : `${lockPrefix}${firearmId}`
}

export function setAssessmentLock(firearmId, locked, classId = '') {
  try {
    const key = getAssessmentLockKey(firearmId, classId)
    if (locked) localStorage.setItem(key, new Date().toISOString())
    else localStorage.removeItem(key)
  } catch {
    // The database remains authoritative if browser Storage is unavailable.
  }
}

export function getStudentFirearmDestination(firearmId, assessmentInProgress, classId = '') {
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  return assessmentInProgress
    ? `/student/models/${firearmId}/assessment${classQuery}`
    : `/student/models/${firearmId}${classQuery}`
}
