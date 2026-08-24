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
