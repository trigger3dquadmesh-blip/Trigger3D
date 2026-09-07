export function createQuestionDeadline(now, durationSeconds) {
  return now + durationSeconds * 1000
}

export function secondsUntilDeadline(deadline, now) {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
