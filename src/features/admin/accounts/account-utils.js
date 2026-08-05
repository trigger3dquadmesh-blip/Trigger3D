export function accountMatchesSearch(account, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [account.full_name, account.email, account.role]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery))
}

export function isAccountDeleteConfirmed(email, confirmation) {
  return confirmation?.trim().toLowerCase() === email.trim().toLowerCase()
}

export function getAccountRelationship(account, classes, enrollments) {
  if (account.role === 'faculty') {
    const assignedClasses = classes.filter((classroom) => classroom.faculty_id === account.id)
    if (!assignedClasses.length) return 'No assigned classes'

    const activeCount = assignedClasses.filter((classroom) => !classroom.archived_at).length
    return `${assignedClasses.length} class${assignedClasses.length === 1 ? '' : 'es'} (${activeCount} active)`
  }

  if (account.role === 'student') {
    const activeEnrollment = enrollments.find(
      (enrollment) => enrollment.student_id === account.id && enrollment.status === 'active',
    )

    return activeEnrollment?.class
      ? `${activeEnrollment.class.name} (${activeEnrollment.class.code})`
      : 'Not actively enrolled'
  }

  return 'System administrator'
}
