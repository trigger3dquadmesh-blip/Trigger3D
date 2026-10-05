export function isClassDeleteConfirmed(classCode, confirmation) {
  return typeof confirmation === 'string'
    && confirmation.trim().toUpperCase() === classCode
}

export function sortClassesByName(classes) {
  return [...classes].sort((first, second) => (
    first.name.localeCompare(second.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  ))
}

export function getClassTerm(classItem) {
  return classItem?.term?.trim() || 'Current term'
}

export function getDefaultAcademicYear(date = new Date()) {
  const year = date.getFullYear()
  const startYear = date.getMonth() >= 5 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

export function formatSemesterTerm(semester, academicYear) {
  const year = academicYear.trim().slice(0, 4)
  const semesterNumber = semester.trim().startsWith('2') ? '2' : '1'
  return `${year}-${semesterNumber}`
}

export function getClassTerms(classes) {
  return [...new Set(classes.map(getClassTerm))].sort((first, second) => (
    first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' })
  ))
}

export function filterClasses(classes, { query = '', status = 'active', term = 'all' } = {}) {
  const normalizedQuery = query.trim().toLowerCase()
  return classes.filter((item) => {
    const itemTerm = getClassTerm(item)
    const hasStatus = status === 'archived' ? Boolean(item.archived_at) : !item.archived_at
    const hasTerm = term === 'all' || itemTerm === term
    const matchesQuery = !normalizedQuery
      || `${item.name} ${item.code} ${itemTerm}`.toLowerCase().includes(normalizedQuery)
    return hasStatus && hasTerm && matchesQuery
  }).sort((first, second) => {
    if (status !== 'archived') return first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' })
    const firstDate = first.end_date || first.archived_at || first.created_at || ''
    const secondDate = second.end_date || second.archived_at || second.created_at || ''
    return secondDate.localeCompare(firstDate) || second.name.localeCompare(first.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}
