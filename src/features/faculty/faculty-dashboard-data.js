export function getActiveFacultyDashboardData({ attempts, classes, enrollments }) {
  const activeClasses = classes.filter((item) => !item.archived_at)
  const activeClassIds = new Set(activeClasses.map((item) => item.id))
  const activeEnrollments = enrollments.filter(
    (item) => item.status === 'active' && activeClassIds.has(item.class_id),
  )
  const activeEnrollmentKeys = new Set(
    activeEnrollments.map((item) => `${item.class_id}:${item.student_id}`),
  )
  const submittedAttempts = attempts
    .filter((item) => (
      item.status === 'submitted'
      && activeEnrollmentKeys.has(`${item.class_id}:${item.student_id}`)
    ))
    .sort((a, b) => (
      new Date(b.submitted_at || b.started_at || 0)
      - new Date(a.submitted_at || a.started_at || 0)
    ))

  return { activeClasses, activeClassIds, activeEnrollments, submittedAttempts }
}
