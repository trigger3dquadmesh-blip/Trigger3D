export function getStudentGreeting(profile, storage) {
  const name = profile?.full_name || 'Student'
  const storageKey = `trigger3d-student-welcomed-${profile?.id || 'guest'}`

  try {
    const hasVisitedBefore = storage.getItem(storageKey) === 'true'
    storage.setItem(storageKey, 'true')
    return hasVisitedBefore ? `Welcome back, ${name}.` : `Welcome, ${name}.`
  } catch {
    return `Welcome, ${name}.`
  }
}
