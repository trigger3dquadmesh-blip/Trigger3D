import assert from 'node:assert/strict'
import test from 'node:test'
import { clearFirearmImportDraft, FIREARM_IMPORT_DRAFT_KEY, getFirearmImportDraft, saveFirearmImportDraft } from '../src/features/admin/import/firearm-import-draft.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

test('preserves firearm information while the upload is unfinished', () => {
  const storage = createStorage()
  const draft = {
    name: 'Generic M1911 A2 Pattern',
    caliber: '.45 ACP',
    description: 'Training model',
    firearmType: 'short_arm',
    tutorialUrl: 'https://www.youtube.com/watch?v=example',
    modelCredit: 'Model creator',
  }

  saveFirearmImportDraft(storage, draft)

  assert.deepEqual(getFirearmImportDraft(storage), draft)
})

test('ignores a malformed firearm upload draft', () => {
  const storage = createStorage()
  storage.setItem(FIREARM_IMPORT_DRAFT_KEY, '{not-json')

  assert.equal(getFirearmImportDraft(storage), null)
})

test('removes empty and completed firearm upload drafts', () => {
  const storage = createStorage()

  saveFirearmImportDraft(storage, { name: 'M1911' })
  clearFirearmImportDraft(storage)
  assert.equal(getFirearmImportDraft(storage), null)

  saveFirearmImportDraft(storage, { name: ' ', caliber: '', description: '' })
  assert.equal(getFirearmImportDraft(storage), null)
})
