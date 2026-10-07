export const FIREARM_IMPORT_DRAFT_KEY = 'trigger3d.admin.firearm-import-draft'

const draftFields = ['name', 'caliber', 'description', 'firearmType', 'tutorialUrl', 'modelCredit']

export function getFirearmImportDraft(storage) {
  try {
    const savedDraft = storage.getItem(FIREARM_IMPORT_DRAFT_KEY)
    if (!savedDraft) return null

    const parsedDraft = JSON.parse(savedDraft)
    if (!parsedDraft || typeof parsedDraft !== 'object' || Array.isArray(parsedDraft)) return null

    return Object.fromEntries(draftFields.map((field) => [field, typeof parsedDraft[field] === 'string' ? parsedDraft[field] : '']))
  } catch {
    return null
  }
}

export function saveFirearmImportDraft(storage, draft) {
  try {
    const safeDraft = Object.fromEntries(draftFields.map((field) => [field, typeof draft[field] === 'string' ? draft[field] : '']))
    const hasInput = Object.values(safeDraft).some((value) => value.trim())

    if (!hasInput) {
      storage.removeItem(FIREARM_IMPORT_DRAFT_KEY)
      return
    }

    storage.setItem(FIREARM_IMPORT_DRAFT_KEY, JSON.stringify(safeDraft))
  } catch {
    // Browser storage can be unavailable. The upload form remains usable without draft recovery.
  }
}

export function clearFirearmImportDraft(storage) {
  try {
    storage.removeItem(FIREARM_IMPORT_DRAFT_KEY)
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}
