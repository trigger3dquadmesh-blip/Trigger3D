import { assessmentAttemptIsSubmitted, selectCurrentAssessmentAttempts } from '../shared/current-assessment-attempts.js'
import { getAssessmentAccessState } from '../student/assessment/assessment-lock.js'

export function buildClassAnalyticsData({ attempts, classId, enrollments, releases }) {
  const studentIds = new Set(enrollments
    .filter((item) => item.status === 'active' && (!item.class_id || item.class_id === classId))
    .map((item) => item.student?.id || item.student_id).filter(Boolean))
  const classReleases = [...new Map(releases.filter((item) => item.class_id === classId)
    .map((item) => [item.firearm_id, item])).values()]
  const firearmIds = new Set(classReleases.map((item) => item.firearm_id))
  const current = selectCurrentAssessmentAttempts(attempts.filter((item) => (
    item.class_id === classId && studentIds.has(item.student_id) && firearmIds.has(item.firearm_id)
  )))
  const submitted = current.filter(assessmentAttemptIsSubmitted)
  const states = current.map(getAssessmentAccessState)
  const inProgress = states.filter((state) => state === 'in_progress').length
  const locked = states.filter((state) => state === 'locked').length
  const paused = states.filter((state) => state === 'paused').length
  const assigned = studentIds.size * classReleases.length
  return { activeStudentIds: studentIds, classReleases, submitted, inProgress, locked, paused, assigned,
    notStarted: assigned - submitted.length - inProgress - locked - paused,
    completedRate: assigned ? submitted.length / assigned * 100 : 0,
    inProgressRate: assigned ? inProgress / assigned * 100 : 0 }
}
