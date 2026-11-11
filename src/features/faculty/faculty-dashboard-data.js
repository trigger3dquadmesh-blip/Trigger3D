import { selectCurrentAssessmentAttempt } from './assessment-status.js'
import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'

export function getActiveFacultyDashboardData({ attempts, classes, enrollments }) {
  const activeClasses = classes.filter((item) => !item.archived_at)
  const activeClassIds = new Set(activeClasses.map((item) => item.id))
  const activeEnrollments = enrollments.filter(
    (item) => item.status === 'active' && activeClassIds.has(item.class_id),
  )
  const activeEnrollmentKeys = new Set(
    activeEnrollments.map((item) => `${item.class_id}:${item.student_id}`),
  )
  const attemptsByAssignment = new Map()
  attempts
    .filter((item) => activeEnrollmentKeys.has(`${item.class_id}:${item.student_id}`))
    .forEach((item) => {
      const key = `${item.class_id}:${item.student_id}:${item.firearm_id}`
      attemptsByAssignment.set(key, [...(attemptsByAssignment.get(key) || []), item])
    })
  const currentAttempts = [...attemptsByAssignment.values()]
    .map(selectCurrentAssessmentAttempt)
    .filter(Boolean)
  const submittedAttempts = currentAttempts
    .filter(assessmentAttemptIsSubmitted)
    .sort((a, b) => (
      new Date(b.submitted_at || b.started_at || 0)
      - new Date(a.submitted_at || a.started_at || 0)
    ))

  return { activeClasses, activeClassIds, activeEnrollments, currentAttempts, submittedAttempts }
}
