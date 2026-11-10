import { useEffect, useMemo, useRef, useState } from 'react'
import useAuth from '../../auth/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import AdminDesignModal, { AdminBadge, AdminButton, AdminField } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'
import { isAccountDeleteConfirmed } from './accounts/account-utils.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

function CreateAccountModal({ onClose, onCreate, open }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'faculty' })
  const [errors, setErrors] = useState({})

  function submit() {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    if (form.password.length < 12) nextErrors.password = 'Use at least 12 characters.'
    else if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) nextErrors.password = 'Include uppercase, lowercase, number, and symbol.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onCreate(form)
    setForm({ name: '', email: '', password: '', role: 'faculty' })
  }

  const inputClass = 'h-9 w-full rounded-[7px] border border-[#b8c1bb] bg-[#f8faf9] px-3 text-sm outline-none placeholder:text-[#9ca69f] focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20'
  return (
    <AdminDesignModal description="The account will be activated immediately with the temporary password below. Share the credentials securely with the user." footer={<><AdminButton kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton onClick={submit}>Create Account</AdminButton></>} onClose={onClose} open={open} title="Create Account">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <AdminField error={errors.name} label="Full Name"><input className={inputClass} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Dr. Maria Santos" value={form.name} /></AdminField>
        <AdminField error={errors.email} label="Institutional Email"><input className={inputClass} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="user@institution.edu.ph" type="email" value={form.email} /></AdminField>
        <AdminField error={errors.password} label="Temporary Password"><input autoComplete="new-password" className={inputClass} minLength="12" onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" value={form.password} /></AdminField>
        <AdminField label="Role"><select className={inputClass} onChange={(event) => setForm({ ...form, role: event.target.value })} value={form.role}><option value="faculty">Faculty</option><option value="admin">Administrator</option></select></AdminField>
        <p className="m-0 rounded-[6px] bg-[#edf0ee] px-3 py-2 text-[11px] leading-4 text-[#5f6b63]">Student accounts are created through public registration. Faculty and Administrator accounts can be provisioned here.</p>
      </form>
    </AdminDesignModal>
  )
}

function ConfirmAccountModal({ action, account, accounts = [], onClose, onConfirm }) {
  const isArchive = action === 'archive'
  const affectedAccounts = accounts.length ? accounts : account ? [account] : []
  const isBulk = affectedAccounts.length > 1
  const subject = isBulk ? `${affectedAccounts.length} accounts` : (account?.full_name || account?.email || 'account')
  return <AdminDesignModal description={isArchive ? `${isBulk ? 'These accounts' : 'This account'} will be archived and access will be restricted.` : `${isBulk ? 'These accounts' : 'This account'} will be restored to active status.`} footer={<><AdminButton kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton kind={isArchive ? 'danger' : 'primary'} onClick={onConfirm}>{isArchive ? `Archive ${isBulk ? 'Accounts' : 'Account'}` : `Restore ${isBulk ? 'Accounts' : 'Account'}`}</AdminButton></>} onClose={onClose} open={affectedAccounts.length > 0} title={`${isArchive ? 'Archive' : 'Restore'} ${subject}?`}><div className={isArchive ? 'admin-confirmation-note danger' : 'admin-confirmation-note success'}><strong>{isArchive ? 'What happens next' : 'Account access'}</strong><span>{isArchive ? `${isBulk ? 'The selected users' : 'This user'} will no longer be able to sign in. Their classes, assessments, and activity records will be preserved.` : `${isBulk ? 'The selected users' : 'This user'} can sign in again with their existing ${isBulk ? 'roles' : 'role'} and all previous records.`}</span></div></AdminDesignModal>
}

function DeleteAccountModal({ account, confirmation, onClose, onConfirm, onConfirmationChange, saving }) {
  if (!account) return null
  const confirmed = isAccountDeleteConfirmed(account.email, confirmation)
  return <AdminDesignModal description="This permanently removes the account and its related Trigger3D records. This action cannot be undone." footer={<><AdminButton disabled={saving} kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton disabled={saving || !confirmed} kind="danger" onClick={onConfirm}>{saving ? 'Deleting…' : 'Delete Account'}</AdminButton></>} onClose={onClose} open title={`Delete ${account.full_name || account.email}?`}><div className="grid gap-4"><div className="admin-confirmation-note danger"><strong>Permanent action</strong><span>Archive the account instead if its classes, assessments, and activity records may be needed later.</span></div><AdminField label={<span>Type “<strong>{account.email}</strong>” to confirm.</span>}><input autoComplete="off" autoFocus className="h-10 rounded-[7px] border border-[var(--admin-border)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-input-text)] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" onChange={(event) => onConfirmationChange(event.target.value)} spellCheck="false" value={confirmation} /></AdminField></div></AdminDesignModal>
}

function BulkDeleteAccountsModal({ accounts = [], confirmation, onClose, onConfirm, onConfirmationChange, saving }) {
  if (accounts.length < 2) return null
  const confirmationPhrase = `DELETE ${accounts.length} ACCOUNTS`
  const confirmed = confirmation.trim().toUpperCase() === confirmationPhrase
  const selectedEmails = accounts.map((account) => account.email)
  return <AdminDesignModal description={`This permanently removes ${accounts.length} accounts and their related Trigger3D records. This action cannot be undone.`} footer={<><AdminButton disabled={saving} kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton disabled={saving || !confirmed} kind="danger" onClick={onConfirm}>{saving ? 'Deleting…' : 'Delete Accounts'}</AdminButton></>} onClose={onClose} open title={`Delete ${accounts.length} accounts?`}><div className="grid gap-4"><div className="admin-confirmation-note danger"><strong>Permanent bulk action</strong><span>You are deleting {selectedEmails.map((email, index) => <span key={email}>{index > 0 && (index === selectedEmails.length - 1 ? ' and ' : ', ')}<strong>{email}</strong></span>)}. Archive these accounts instead if their records may be needed later.</span></div><AdminField label={`Type “${confirmationPhrase}” to confirm.`}><input autoComplete="off" autoFocus className="h-10 rounded-[7px] border border-[var(--admin-border)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-input-text)] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" onChange={(event) => onConfirmationChange(event.target.value)} spellCheck="false" value={confirmation} /></AdminField></div></AdminDesignModal>
}

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

async function functionErrorMessage(error) {
  try {
    const payload = await error.context?.json()
    return payload?.error || error.message
  } catch {
    return error.message
  }
}

const ACCOUNTS_PER_PAGE = 20

export default function AdminAccountsPanel({ accounts, dataError, loading, onChanged, onRefresh }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [expandedAccountId, setExpandedAccountId] = useState(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const lastRefreshAt = useRef(0)
  useAutoDismissNotice(notice, () => setNotice(''), 5000)
  useAutoDismissNotice(error, () => setError(''), 6500)

  useEffect(() => {
    function refreshVisibleAccounts() {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefreshAt.current < 1000) return
      lastRefreshAt.current = Date.now()
      void onRefresh?.()
    }
    window.addEventListener('focus', refreshVisibleAccounts)
    document.addEventListener('visibilitychange', refreshVisibleAccounts)
    return () => {
      window.removeEventListener('focus', refreshVisibleAccounts)
      document.removeEventListener('visibilitychange', refreshVisibleAccounts)
    }
  }, [onRefresh])

  const filtered = useMemo(() => accounts.filter((account) => (tab === 'archived' ? Boolean(account.disabled_at) : !account.disabled_at) && (role === 'all' || account.role === role) && (!query || ((account.full_name || '') + account.email).toLowerCase().includes(query.toLowerCase()))), [accounts, query, role, tab])
  const pageCount = Math.max(1, Math.ceil(filtered.length / ACCOUNTS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const visibleAccounts = useMemo(() => filtered.slice((currentPage - 1) * ACCOUNTS_PER_PAGE, currentPage * ACCOUNTS_PER_PAGE), [currentPage, filtered])
  const selectableAccounts = useMemo(() => visibleAccounts.filter((account) => account.id !== user?.id), [visibleAccounts, user?.id])
  const allVisibleSelected = selectableAccounts.length > 0 && selectableAccounts.every((account) => selectedAccountIds.includes(account.id))
  const count = (status) => accounts.filter((account) => status === 'archived' ? Boolean(account.disabled_at) : !account.disabled_at).length

  function toggleAccountSelection(accountId) {
    setSelectedAccountIds((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId])
  }

  function toggleAllVisible() {
    setSelectedAccountIds(allVisibleSelected ? [] : selectableAccounts.map((account) => account.id))
  }

  function beginDelete(account) {
    setDeleteConfirmation('')
    setError('')
    setNotice('')
    setTarget({ action: 'delete', account })
  }

  async function createAccount(form) {
    setSaving(true)
    setError('')
    const action = form.role === 'faculty' ? 'create_faculty' : 'create_account'
    const { data, error: requestError } = await supabase.functions.invoke('admin-users', { body: { action, email: form.email, full_name: form.name, password: form.password, role: form.role } })
    if (requestError) setError(await functionErrorMessage(requestError))
    else {
      setNotice((form.role === 'admin' ? 'Administrator' : 'Faculty') + ' account created for ' + data.user.email + '.')
      if (data.audit_warning) setError(`The account was created, but the activity could not be recorded: ${data.audit_warning}`)
      setTab('active')
      setCreateOpen(false)
      await onChanged()
    }
    setSaving(false)
  }

  async function confirmTarget() {
    setSaving(true)
    setError('')
    const targetAccounts = target.accounts?.length ? target.accounts : [target.account]
    const disabled = target.action === 'archive'
    const results = await Promise.all(targetAccounts.map((account) => supabase.rpc('admin_update_account', { target_user_id: account.id, new_full_name: account.full_name, new_role: account.role, new_disabled: disabled })))
    const failed = results.filter((result) => result.error)
    if (failed.length) setError(failed.length === targetAccounts.length ? failed[0].error.message : `${failed.length} of ${targetAccounts.length} accounts could not be updated. ${failed[0].error.message}`)
    if (failed.length < targetAccounts.length) {
      const changedCount = targetAccounts.length - failed.length
      setNotice(changedCount === 1 ? `${targetAccounts.find((_, index) => !results[index].error)?.email} was ${disabled ? 'archived.' : 'restored.'}` : `${changedCount} accounts were ${disabled ? 'archived.' : 'restored.'}`)
      setTarget(null)
      setSelectedAccountIds([])
      await onChanged()
    }
    setSaving(false)
  }

  async function deleteAccount() {
    const account = target?.account
    if (!account || !isAccountDeleteConfirmed(account.email, deleteConfirmation)) {
      setError('Type the complete account email address to confirm permanent deletion.')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: requestError } = await supabase.functions.invoke('admin-users', { body: { action: 'delete_user', user_id: account.id } })
    if (requestError) setError(await functionErrorMessage(requestError))
    else {
      setNotice(data.deletion_warning ? `${account.email} was removed. ${data.deletion_warning}` : `${account.email} and its related records were permanently deleted.`)
      if (data.audit_warning) setError(`The account was deleted, but the activity could not be recorded: ${data.audit_warning}`)
      setTarget(null)
      setDeleteConfirmation('')
      setSelectedAccountIds((current) => current.filter((id) => id !== account.id))
      await onChanged()
    }
    setSaving(false)
  }

  async function deleteSelectedAccounts() {
    const targetAccounts = target?.accounts || []
    const confirmationPhrase = `DELETE ${targetAccounts.length} ACCOUNTS`
    if (targetAccounts.length < 2 || deleteConfirmation.trim().toUpperCase() !== confirmationPhrase) {
      setError(`Type “${confirmationPhrase}” to confirm permanent deletion.`)
      return
    }
    setSaving(true)
    setError('')
    const results = await Promise.all(targetAccounts.map((account) => supabase.functions.invoke('admin-users', { body: { action: 'delete_user', user_id: account.id } })))
    const failed = results.filter((result) => result.error)
    const deletedCount = targetAccounts.length - failed.length
    if (failed.length) setError(failed.length === targetAccounts.length ? await functionErrorMessage(failed[0].error) : `${failed.length} of ${targetAccounts.length} accounts could not be deleted.`)
    if (deletedCount > 0) {
      setNotice(`${deletedCount} account${deletedCount === 1 ? '' : 's'} ${deletedCount === 1 ? 'was' : 'were'} permanently deleted.`)
      setTarget(null)
      setDeleteConfirmation('')
      setSelectedAccountIds([])
      await onChanged()
    }
    setSaving(false)
  }

  if (loading) return <section className="admin-accounts-page w-full p-6"><DashboardLoading label="Loading accounts…" /></section>

  return (
    <section className="admin-accounts-page w-full p-6 text-[#172019]">
      <div className="mb-6 flex items-end justify-between gap-4"><div><nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Accounts</span></nav><h1 className="m-0 text-xl font-semibold">Account Management</h1></div><AdminButton onClick={() => setCreateOpen(true)}><AdminIcon name="userPlus" /> Create Account</AdminButton></div>
      {dataError && <div className="alert alert-error" role="alert">{dataError}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="admin-account-toolbar mb-4 flex flex-col items-end gap-3 sm:flex-row">
        <div className="flex self-stretch border-b border-[#b8c1bb] sm:self-auto">{[['active', 'Active'], ['archived', 'Archived']].map(([id, label]) => <button className={'px-4 py-2.5 text-sm ' + (tab === id ? 'border-b-2 border-[#109d1a] font-medium text-[#109d1a]' : 'text-[#5f6b63]')} key={id} onClick={() => { setTab(id); setPage(1); setSelectedAccountIds([]); setExpandedAccountId(null) }} type="button">{label} <span className="ml-1 rounded-full bg-[#edf0ee] px-1.5 py-0.5 text-[11px]">{count(id)}</span></button>)}</div>
        <div className="admin-account-tools flex gap-2 sm:ml-auto"><label className="admin-account-select-all"><input checked={allVisibleSelected} disabled={selectableAccounts.length === 0} onChange={toggleAllVisible} type="checkbox" /><span>{selectedAccountIds.length ? `${selectedAccountIds.length} selected` : 'Select page'}</span></label>{selectedAccountIds.length > 1 && <><button aria-label={`${tab === 'archived' ? 'Restore' : 'Archive'} ${selectedAccountIds.length} selected accounts`} className="admin-account-bulk-action" disabled={saving} onClick={() => setTarget({ action: tab === 'archived' ? 'restore' : 'archive', accounts: selectableAccounts.filter((account) => selectedAccountIds.includes(account.id)) })} title={`${tab === 'archived' ? 'Restore' : 'Archive'} selected accounts`} type="button"><AdminIcon name={tab === 'archived' ? 'restore' : 'archive'} /><span>{tab === 'archived' ? 'Restore' : 'Archive'}</span></button><button aria-label={`Remove ${selectedAccountIds.length} selected accounts`} className="admin-account-bulk-delete" disabled={saving} onClick={() => { setDeleteConfirmation(''); setTarget({ action: 'bulk-delete', accounts: selectableAccounts.filter((account) => selectedAccountIds.includes(account.id)) }) }} title="Remove selected accounts" type="button"><AdminIcon name="trash" /><span>Remove</span></button></>}<label className="admin-role-filter"><span className="sr-only">Filter accounts by role</span><select className="h-9 rounded-[7px] border border-[#b8c1bb] bg-white px-3 pr-9 text-xs" onChange={(event) => { setRole(event.target.value); setPage(1); setSelectedAccountIds([]); setExpandedAccountId(null) }} value={role}><option value="all">All roles</option><option value="admin">Admin</option><option value="faculty">Faculty</option><option value="student">Student</option></select><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></label><label className="admin-search-field"><AdminIcon name="search" /><span className="sr-only">Search accounts</span><input className="h-9 w-56 rounded-[7px] border border-[#b8c1bb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => { setQuery(event.target.value); setPage(1); setSelectedAccountIds([]); setExpandedAccountId(null) }} placeholder="Search name or email..." type="search" value={query} /></label></div>
      </div>
      {tab === 'archived' && <div className="mb-4 rounded-[7px] border border-[#b8c1bb] bg-[#edf0ee] px-4 py-3 text-xs text-[#5f6b63]">Archived accounts retain their existing records and can be restored at any time.</div>}
      <div className="overflow-x-auto rounded-[10px] border border-[#b8c1bb] bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead><tr className="bg-[#f6f8f7]">{['Account', 'Role', 'Status', 'Created', 'Last Login', ''].map((heading) => <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6b63] first:pl-5" key={heading}>{heading}</th>)}</tr></thead>
          {visibleAccounts.map((account) => {
            const protectedAccount = account.id === user?.id
            const actionLabel = account.disabled_at ? 'Restore' : 'Archive'
            const isExpanded = expandedAccountId === account.id
            const detailsId = `account-details-${account.id}`
            return (
              <tbody className={`admin-account-entry${isExpanded ? ' open' : ''}`} key={account.id}>
                <tr className="admin-account-summary-row group h-[61px] hover:bg-[#f8faf9]">
                  <td className="pl-5 pr-4">
                    <div className="admin-account-summary-content flex items-center gap-2.5">
                      {!protectedAccount && <input aria-label={`Select ${account.full_name || account.email}`} checked={selectedAccountIds.includes(account.id)} className="admin-account-checkbox" onChange={() => toggleAccountSelection(account.id)} type="checkbox" />}
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf0ee] text-[11px] font-semibold">{(account.full_name || account.email)[0]}</span>
                      <div className="admin-account-identity"><p className="m-0 text-sm font-medium">{account.full_name || 'Name not provided'}{protectedAccount && <span className="ml-1 text-[#5f6b63]">◇</span>}</p><p className="m-0 text-[11px] text-[#5f6b63]">{account.email}</p></div>
                      <div className="admin-account-mobile-controls">
                        {protectedAccount ? <span className="admin-account-protected text-[11px] text-[#5f6b63]">Protected</span> : <><button aria-label={`${actionLabel} ${account.full_name || account.email}`} className={`admin-account-action ${account.disabled_at ? 'restore' : 'archive'}`} disabled={saving} onClick={() => setTarget({ action: account.disabled_at ? 'restore' : 'archive', account })} title={`${actionLabel} account`} type="button"><AdminIcon name={account.disabled_at ? 'restore' : 'archive'} /></button><button aria-label={`Delete ${account.full_name || account.email}`} className="admin-account-delete" disabled={saving} onClick={() => beginDelete(account)} title="Delete account" type="button"><AdminIcon name="trash" /></button></>}
                        <button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${account.full_name || account.email}`} className="admin-account-expand" onClick={() => setExpandedAccountId((current) => current === account.id ? null : account.id)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4"><AdminBadge>{account.role}</AdminBadge></td>
                  <td className="px-4"><AdminBadge status={account.disabled_at ? 'archived' : 'active'}>{account.disabled_at ? 'Archived' : 'Active'}</AdminBadge></td>
                  <td className="px-4 text-xs text-[#5f6b63]">{formatDate(account.created_at)}</td>
                  <td className="px-4 text-xs text-[#5f6b63]">{formatDate(account.last_sign_in_at)}</td>
                  <td className="px-4 text-right">{protectedAccount ? <span className="text-[11px] text-[#5f6b63]">Protected</span> : <span className="admin-account-row-actions"><button aria-label={`${actionLabel} ${account.full_name || account.email}`} className={`admin-account-action ${account.disabled_at ? 'restore' : 'archive'}`} disabled={saving} onClick={() => setTarget({ action: account.disabled_at ? 'restore' : 'archive', account })} title={`${actionLabel} account`} type="button"><AdminIcon name={account.disabled_at ? 'restore' : 'archive'} /></button><button aria-label={`Delete ${account.full_name || account.email}`} className="admin-account-delete" disabled={saving} onClick={() => beginDelete(account)} title="Delete account" type="button"><AdminIcon name="trash" /></button></span>}</td>
                </tr>
                <tr className="admin-account-mobile-details" id={detailsId}>
                  <td colSpan="6"><dl><div><dt>Role</dt><dd>{account.role}</dd></div><div><dt>Status</dt><dd>{account.disabled_at ? 'Archived' : 'Active'}</dd></div><div><dt>Created</dt><dd>{formatDate(account.created_at)}</dd></div><div><dt>Last login</dt><dd>{formatDate(account.last_sign_in_at)}</dd></div></dl></td>
                </tr>
              </tbody>
            )
          })}
        </table>
        {filtered.length === 0 && <p className="m-0 p-12 text-center text-sm text-[#5f6b63]">No accounts found.</p>}
        {filtered.length > ACCOUNTS_PER_PAGE && <div className="flex items-center justify-between gap-3 border-t border-[#b8c1bb] px-4 py-3 text-xs text-[#5f6b63]"><span>Showing {(currentPage - 1) * ACCOUNTS_PER_PAGE + 1}–{Math.min(currentPage * ACCOUNTS_PER_PAGE, filtered.length)} of {filtered.length} accounts</span><div className="flex gap-2"><button className="rounded-[7px] border border-[#b8c1bb] bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedAccountIds([]); setExpandedAccountId(null) }} type="button">Previous</button><button className="rounded-[7px] border border-[#b8c1bb] bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedAccountIds([]); setExpandedAccountId(null) }} type="button">Next</button></div></div>}
      </div>
      <CreateAccountModal onClose={() => setCreateOpen(false)} onCreate={createAccount} open={createOpen} />
      <ConfirmAccountModal account={target?.action === 'delete' || target?.action === 'bulk-delete' ? null : target?.account} accounts={target?.action === 'delete' || target?.action === 'bulk-delete' ? [] : target?.accounts} action={target?.action} onClose={() => setTarget(null)} onConfirm={confirmTarget} />
      <DeleteAccountModal account={target?.action === 'delete' ? target.account : null} confirmation={deleteConfirmation} onClose={() => { setTarget(null); setDeleteConfirmation('') }} onConfirm={deleteAccount} onConfirmationChange={setDeleteConfirmation} saving={saving} />
      <BulkDeleteAccountsModal accounts={target?.action === 'bulk-delete' ? target.accounts : []} confirmation={deleteConfirmation} onClose={() => { setTarget(null); setDeleteConfirmation('') }} onConfirm={deleteSelectedAccounts} onConfirmationChange={setDeleteConfirmation} saving={saving} />
    </section>
  )
}
