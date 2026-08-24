export function filterEnrollmentsByStudentQuery(enrollments, query) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return enrollments

  return enrollments.filter((enrollment) => {
    const student = enrollment.student || {}
    return [student.full_name, student.email].some((value) => (
      String(value || '').toLowerCase().includes(normalizedQuery)
    ))
  })
}
