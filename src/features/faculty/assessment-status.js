function displayName(student) {
  const name = student.full_name?.trim()
  return name || 'Name not provided'
}

function surname(name) {
  return name === 'Name not provided' ? '' : name.trim().split(/\s+/).at(-1)
}

export function buildAssessmentActivity(enrollments, releases, firearms, attempts) {
  const firearmById = new Map(firearms.map((firearm) => [firearm.id, firearm]))
  const attemptByStudentAndFirearm = new Map(
    attempts.map((attempt) => [`${attempt.student_id}:${attempt.firearm_id}`, attempt]),
  )

  return enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .flatMap((enrollment) => releases.map((release) => {
      const firearm = firearmById.get(release.firearm_id)
      const attempt = attemptByStudentAndFirearm.get(`${enrollment.student_id}:${release.firearm_id}`)
      const status = attempt?.status === 'submitted'
        ? 'submitted'
        : !release.is_open
          ? 'closed'
          : attempt?.status === 'in_progress' && attempt.has_activity
            ? 'in_progress'
            : 'not_started'

      return {
        attempt_id: attempt?.id || '',
        firearm_name: firearm?.name || 'Assessment',
        percentage: attempt?.percentage,
        attempt_count: attempt?.attempt_number || 0,
        status,
        student_email: enrollment.student.email,
        student_name: displayName(enrollment.student),
      }
    }))
    .sort((left, right) => surname(left.student_name).localeCompare(surname(right.student_name), undefined, {
      sensitivity: 'base',
    }) || left.student_name.localeCompare(right.student_name, undefined, { sensitivity: 'base' })
      || left.firearm_name.localeCompare(right.firearm_name, undefined, { sensitivity: 'base' }))
}

export function assessmentStatusDetails(status) {
  const details = {
    submitted: { className: 'active', label: 'Submitted', symbol: '✓' },
    in_progress: { className: 'in-progress', label: 'In progress', symbol: '◐' },
    not_started: { className: 'not-started', label: 'Not started', symbol: '○' },
    closed: { className: 'removed', label: 'Closed', symbol: '—' },
  }

  return details[status] || details.closed
}
