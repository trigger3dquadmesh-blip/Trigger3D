export function getViewedFirearmKey(studentId, classId, firearmId) {
  return `trigger3d.viewed-firearm.${studentId}.${classId}.${firearmId}`
}

export function hasViewedFirearm(storage, studentId, classId, firearmId) {
  if (!studentId || !classId || !firearmId) return false
  return Boolean(storage.getItem(getViewedFirearmKey(studentId, classId, firearmId)))
}

export function markFirearmViewed(storage, studentId, classId, firearmId) {
  if (!studentId || !classId || !firearmId) return
  storage.setItem(getViewedFirearmKey(studentId, classId, firearmId), new Date().toISOString())
}
