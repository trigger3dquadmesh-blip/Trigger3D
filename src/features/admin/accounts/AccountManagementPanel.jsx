import { useCallback, useEffect, useMemo, useState } from 'react'
import useAuth from '../../../auth/useAuth.js'
import { supabase } from '../../../lib/supabase.js'
import {
  accountMatchesSearch,
  getAccountRelationship,
  isAccountDeleteConfirmed,
} from './account-utils.js'

const emptyFacultyForm = { fullName: '', email: '', password: '' }

async function getFunctionErrorMessage(error) {
  try {
    const payload = await error.context?.json()
    return payload?.error || error.message
  } catch {
    return error.message
  }
}

export default function AccountManagementPanel() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [classes, setClasses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [query, setQuery] = useState('')
  const [facultyForm, setFacultyForm] = useState(emptyFacultyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ fullName: '', role: 'student' })
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    const [profilesResult, classesResult, enrollmentsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at, disabled_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('classes')
        .select('id, faculty_id, name, code, archived_at'),
      supabase
        .from('enrollments')
        .select('student_id, status, class:classes!enrollments_class_id_fkey(name, code, archived_at)'),
    ])

    const queryError = profilesResult.error || classesResult.error || enrollmentsResult.error
    if (queryError) {
      setError(queryError.message)
    } else {
      setAccounts(profilesResult.data ?? [])
      setClasses(classesResult.data ?? [])
      setEnrollments(enrollmentsResult.data ?? [])
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // State changes happen after the Supabase requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts()
  }, [loadAccounts])

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => accountMatchesSearch(account, query)),
    [accounts, query],
  )

  function startEditing(account) {
    setEditingId(account.id)
    setEditForm({ fullName: account.full_name ?? '', role: account.role })
    setError('')
    setNotice('')
  }

  async function createFaculty(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const { data, error: functionError } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'create_faculty',
        email: facultyForm.email,
        full_name: facultyForm.fullName,
        password: facultyForm.password,
      },
    })

    if (functionError) {
      setError(await getFunctionErrorMessage(functionError))
    } else {
      setNotice(`Faculty account created for ${data.user.email}.`)
      setFacultyForm(emptyFacultyForm)
      await loadAccounts()
    }
    setSaving(false)
  }

  async function saveAccount(account) {
    setSaving(true)
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.rpc('admin_update_account', {
      target_user_id: account.id,
      new_full_name: editForm.fullName,
      new_role: editForm.role,
      new_disabled: Boolean(account.disabled_at),
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotice(`${account.email} was updated.`)
      setEditingId(null)
      await loadAccounts()
    }
    setSaving(false)
  }

  async function setAccountDisabled(account, disabled) {
    setSaving(true)
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.rpc('admin_update_account', {
      target_user_id: account.id,
      new_full_name: account.full_name,
      new_role: account.role,
      new_disabled: disabled,
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotice(`${account.email} was ${disabled ? 'disabled' : 'enabled'}.`)
      await loadAccounts()
    }
    setSaving(false)
  }

  function beginDelete(account) {
    setDeleteTargetId(account.id)
    setDeleteConfirmation('')
    setEditingId(null)
    setError('')
    setNotice('')
  }

  function cancelDelete() {
    setDeleteTargetId(null)
    setDeleteConfirmation('')
  }

  async function deleteAccount(account) {
    if (!isAccountDeleteConfirmed(account.email, deleteConfirmation)) {
      setError('Type the complete account email address to confirm permanent deletion.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    const { data, error: functionError } = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete_user', user_id: account.id },
    })

    if (functionError) {
      setError(await getFunctionErrorMessage(functionError))
    } else {
      setNotice(
        data.deletion_warning
          ? `${account.email} was removed. ${data.deletion_warning}`
          : `${account.email} and their related records were permanently deleted.`,
      )
      cancelDelete()
      await loadAccounts()
    }
    setSaving(false)
  }

  return (
    <article className="dashboard-card account-management-panel">
      <div className="account-panel-heading">
        <div>
          <h2>Accounts</h2>
          <p>Create Faculty accounts and manage names, roles, access, and records.</p>
        </div>
        <input
          aria-label="Search accounts"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, or role"
          type="search"
          value={query}
        />
      </div>

      <form className="faculty-account-form" onSubmit={createFaculty}>
        <h3>Create Faculty account</h3>
        <label>
          Full name
          <input
            minLength="2"
            onChange={(event) => setFacultyForm({ ...facultyForm, fullName: event.target.value })}
            required
            value={facultyForm.fullName}
          />
        </label>
        <label>
          School email
          <input
            onChange={(event) => setFacultyForm({ ...facultyForm, email: event.target.value })}
            placeholder="faculty@parsu.edu.ph"
            required
            type="email"
            value={facultyForm.email}
          />
        </label>
        <label>
          Temporary password
          <input
            minLength="8"
            onChange={(event) => setFacultyForm({ ...facultyForm, password: event.target.value })}
            required
            type="password"
            value={facultyForm.password}
          />
        </label>
        <button disabled={saving} type="submit">{saving ? 'Working...' : 'Create Faculty'}</button>
      </form>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {loading ? (
        <p>Loading accounts...</p>
      ) : visibleAccounts.length === 0 ? (
        <p>No matching accounts found.</p>
      ) : (
        <div className="account-list">
          {visibleAccounts.map((account) => {
            const isSelf = account.id === user?.id
            const isEditing = editingId === account.id
            const isConfirmingDelete = deleteTargetId === account.id
            return (
              <section className="account-row" key={account.id}>
                <div className="account-identity">
                  <strong>{account.full_name || 'Name not provided'}</strong>
                  <span>{account.email}</span>
                  <small>{getAccountRelationship(account, classes, enrollments)}</small>
                </div>
                <div className="account-state">
                  <span className={`status-badge ${account.disabled_at ? 'removed' : 'active'}`}>
                    {account.disabled_at ? 'Disabled' : account.role}
                  </span>
                  {isSelf && <small>Your account</small>}
                </div>
                <div className="account-actions">
                  <button disabled={saving} onClick={() => startEditing(account)} type="button">Edit</button>
                  <button
                    disabled={saving || isSelf}
                    onClick={() => setAccountDisabled(account, !account.disabled_at)}
                    type="button"
                  >
                    {account.disabled_at ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    className="danger-action"
                    disabled={saving || isSelf}
                    onClick={() => beginDelete(account)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                {isEditing && (
                  <div className="account-editor">
                    <label>
                      Full name
                      <input
                        minLength="2"
                        onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
                        value={editForm.fullName}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        disabled={isSelf}
                        onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
                        value={editForm.role}
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <div className="account-editor-actions">
                      <button disabled={saving} onClick={() => saveAccount(account)} type="button">Save</button>
                      <button disabled={saving} onClick={() => setEditingId(null)} type="button">Cancel</button>
                    </div>
                  </div>
                )}
                {isConfirmingDelete && (
                  <div className="account-delete-confirmation">
                    <div>
                      <strong>Permanently delete this account?</strong>
                      <span>
                        This removes its class, enrollment, assessment, and score records.
                        Type <strong>{account.email}</strong> to confirm.
                      </span>
                    </div>
                    <label>
                      Account email
                      <input
                        autoComplete="off"
                        onChange={(event) => setDeleteConfirmation(event.target.value)}
                        placeholder={account.email}
                        type="email"
                        value={deleteConfirmation}
                      />
                    </label>
                    <div className="account-delete-actions">
                      <button
                        className="danger-action"
                        disabled={saving || !isAccountDeleteConfirmed(
                          account.email,
                          deleteConfirmation,
                        )}
                        onClick={() => deleteAccount(account)}
                        type="button"
                      >
                        {saving ? 'Deleting...' : 'Confirm permanent deletion'}
                      </button>
                      <button disabled={saving} onClick={cancelDelete} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </article>
  )
}
