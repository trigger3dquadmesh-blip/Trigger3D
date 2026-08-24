export function getAccountDraft(storage, key) {
  try {
    const savedDraft = storage.getItem(key)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft)
    return draft && typeof draft === 'object' ? draft : null
  } catch {
    return null
  }
}

export function saveAccountDraft(storage, key, draft) {
  const hasFacultyInput = Object.values(draft.facultyForm ?? {}).some((value) => value.trim())
  const hasAccountEdit = Boolean(draft.editingId)
  const hasDeleteConfirmation = Boolean(draft.deleteTargetId)
  const hasSearch = Boolean(draft.query?.trim())
  const hasRoleFilter = draft.roleFilter && draft.roleFilter !== 'all'

  try {
    if (!hasFacultyInput && !hasAccountEdit && !hasDeleteConfirmation && !hasSearch && !hasRoleFilter) {
      storage.removeItem(key)
      return
    }

    storage.setItem(key, JSON.stringify(draft))
  } catch {
    // Storage may be unavailable in a private browser session. Saving to Supabase is unaffected.
  }
}
