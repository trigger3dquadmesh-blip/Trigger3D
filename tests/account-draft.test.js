import assert from 'node:assert/strict'
import test from 'node:test'
import { getAccountDraft, saveAccountDraft } from '../src/features/admin/accounts/account-draft.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

test('preserves an unfinished account edit as a local draft', () => {
  const storage = createStorage()
  const key = 'trigger3d.account-draft.user-1'
  const draft = {
    editingId: 'account-2',
    editForm: { fullName: 'Faculty Name', role: 'faculty' },
    facultyForm: { fullName: '', email: '', password: '' },
  }

  saveAccountDraft(storage, key, draft)

  assert.deepEqual(getAccountDraft(storage, key), draft)
})

test('preserves an open account deletion confirmation', () => {
  const storage = createStorage()
  const key = 'trigger3d.account-draft.user-1'
  const draft = {
    deleteConfirmation: 'faculty@parsu.edu.ph',
    deleteTargetId: 'faculty-1',
    editingId: null,
    editForm: { fullName: '', role: 'student' },
    facultyForm: { fullName: '', email: '', password: '' },
    query: '',
  }

  saveAccountDraft(storage, key, draft)

  assert.deepEqual(getAccountDraft(storage, key), draft)
})

test('removes an empty account draft', () => {
  const storage = createStorage()
  const key = 'trigger3d.account-draft.user-1'

  saveAccountDraft(storage, key, {
    editingId: null,
    editForm: { fullName: '', role: 'student' },
    facultyForm: { fullName: '', email: '', password: '' },
    query: '',
  })

  assert.equal(getAccountDraft(storage, key), null)
})
