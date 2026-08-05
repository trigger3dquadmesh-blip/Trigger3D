export function isFirearmDeleteConfirmed(identifier, confirmation) {
  return confirmation?.trim().toLowerCase() === identifier.trim().toLowerCase()
}
