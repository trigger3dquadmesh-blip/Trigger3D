import { useMemo, useState } from 'react'
import useAuth from '../../auth/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import AdminDesignModal, { AdminBadge, AdminButton, AdminField } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'

function CreateAccountModal({ onClose, onCreate, open }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'faculty' })
  const [errors, setErrors] = useState({})

  function submit() {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onCreate(form)
    setForm({ name: '', email: '', password: '', role: 'faculty' })
  }

  const inputClass = 'h-9 w-full rounded-[7px] border border-[#b8c1bb] bg-[#f8faf9] px-3 text-sm outline-none placeholder:text-[#9ca69f] focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20'
  return (
    <AdminDesignModal description="An invitation will be sent to the provided email address." footer={<><AdminButton kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton onClick={submit}>Create Account</AdminButton></>} onClose={onClose} open={open} title="Create Account">
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <AdminField error={errors.name} label="Full Name"><input className={inputClass} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Dr. Maria Santos" value={form.name} /></AdminField>
        <AdminField error={errors.email} label="Institutional Email"><input className={inputClass} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="user@institution.edu.ph" type="email" value={form.email} /></AdminField>
        <AdminField error={errors.password} label="Temporary Password"><input className={inputClass} minLength="8" onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" value={form.password} /></AdminField>
        <AdminField label="Role"><select className={inputClass} onChange={(event) => setForm({ ...form, role: event.target.value })} value={form.role}><option value="faculty">Faculty</option><option value="admin">Administrator</option></select></AdminField>
        <p className="m-0 rounded-[6px] bg-[#edf0ee] px-3 py-2 text-[11px] leading-4 text-[#5f6b63]">Student accounts are created through public registration. Faculty and Administrator accounts can be provisioned here.</p>
      </form>
    </AdminDesignModal>
  )
}

function ConfirmAccountModal({ action, account, onClose, onConfirm }) {
  const isArchive = action === 'archive'
  return <AdminDesignModal description={isArchive ? 'This account will be archived and access will be restricted.' : 'This account will be restored to active status.'} footer={<><AdminButton kind="ghost" onClick={onClose}>Cancel</AdminButton><AdminButton kind={isArchive ? 'danger' : 'primary'} onClick={onConfirm}>{isArchive ? 'Archive Account' : 'Restore Account'}</AdminButton></>} onClose={onClose} open={Boolean(account)} title={(isArchive ? 'Archive ' : 'Restore ') + (account?.full_name || account?.email || '') + '?'}><div className={isArchive ? 'admin-confirmation-note danger' : 'admin-confirmation-note success'}><strong>{isArchive ? 'What happens next' : 'Account access'}</strong><span>{isArchive ? 'The user will no longer be able to sign in. Their classes, assessments, and activity records will be preserved.' : 'The user can sign in again with their existing role and all previous records.'}</span></div></AdminDesignModal>
}

function formatDate(value) {
  if (!value) return '—'
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

export default function AdminAccountsPanel({ accounts, dataError, loading, onChanged }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => accounts.filter((account) => (tab === 'archived' ? Boolean(account.disabled_at) : !account.disabled_at) && (role === 'all' || account.role === role) && (!query || ((account.full_name || '') + account.email).toLowerCase().includes(query.toLowerCase()))), [accounts, query, role, tab])
  const count = (status) => accounts.filter((account) => status === 'archived' ? Boolean(account.disabled_at) : !account.disabled_at).length

  async function createAccount(form) {
    setSaving(true)
    setError('')
    const action = form.role === 'faculty' ? 'create_faculty' : 'create_account'
    const { data, error: requestError } = await supabase.functions.invoke('admin-users', { body: { action, email: form.email, full_name: form.name, password: form.password, role: form.role } })
    if (requestError) setError(await functionErrorMessage(requestError))
    else {
      setNotice((form.role === 'admin' ? 'Administrator' : 'Faculty') + ' account created for ' + data.user.email + '.')
      setTab('active')
      setCreateOpen(false)
      await onChanged()
    }
    setSaving(false)
  }

  async function confirmTarget() {
    setSaving(true)
    setError('')
    const account = target.account
    const disabled = target.action === 'archive'
    const { error: requestError } = await supabase.rpc('admin_update_account', { target_user_id: account.id, new_full_name: account.full_name, new_role: account.role, new_disabled: disabled })
    if (requestError) setError(requestError.message)
    else {
      setNotice(account.email + ' was ' + (disabled ? 'archived.' : 'restored.'))
      setTarget(null)
      await onChanged()
    }
    setSaving(false)
  }

  return (
    <section className="admin-accounts-page w-full p-6 text-[#172019]">
      <div className="mb-6 flex items-end justify-between gap-4"><div><nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Accounts</span></nav><h1 className="m-0 text-xl font-semibold">Account Management</h1></div><AdminButton onClick={() => setCreateOpen(true)}><AdminIcon name="userPlus" /> Create Account</AdminButton></div>
      {dataError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{dataError}</div>}
      {error && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{error}</div>}
      {notice && <div className="mb-4 rounded-[7px] border border-green-300 bg-green-50 px-4 py-3 text-xs text-green-700" role="status">{notice}</div>}
      <div className="admin-account-toolbar mb-4 flex flex-col items-end gap-3 sm:flex-row">
        <div className="flex self-stretch border-b border-[#b8c1bb] sm:self-auto">{[['active', 'Active'], ['archived', 'Archived']].map(([id, label]) => <button className={'px-4 py-2.5 text-sm ' + (tab === id ? 'border-b-2 border-[#109d1a] font-medium text-[#109d1a]' : 'text-[#5f6b63]')} key={id} onClick={() => setTab(id)} type="button">{label} <span className="ml-1 rounded-full bg-[#edf0ee] px-1.5 py-0.5 text-[11px]">{count(id)}</span></button>)}</div>
        <div className="flex gap-2 sm:ml-auto"><select className="h-9 rounded-[7px] border border-[#b8c1bb] bg-white px-3 text-xs" onChange={(event) => setRole(event.target.value)} value={role}><option value="all">All roles</option><option value="admin">Admin</option><option value="faculty">Faculty</option><option value="student">Student</option></select><label className="admin-search-field"><AdminIcon name="search" /><span className="sr-only">Search accounts</span><input className="h-9 w-56 rounded-[7px] border border-[#b8c1bb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email..." type="search" value={query} /></label></div>
      </div>
      {tab === 'archived' && <div className="mb-4 rounded-[7px] border border-[#b8c1bb] bg-[#edf0ee] px-4 py-3 text-xs text-[#5f6b63]">Archived accounts retain their existing records and can be restored at any time.</div>}
      <div className="overflow-x-auto rounded-[10px] border border-[#b8c1bb] bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead><tr className="bg-[#f6f8f7]">{['Account', 'Role', 'Status', 'Created', 'Last Login', ''].map((heading) => <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6b63] first:pl-5" key={heading}>{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#b8c1bb]">{filtered.map((account) => { const protectedAccount = account.id === user?.id; return <tr className="group h-[61px] hover:bg-[#f8faf9]" key={account.id}><td className="pl-5 pr-4"><div className="flex items-center gap-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf0ee] text-[11px] font-semibold">{(account.full_name || account.email)[0]}</span><div><p className="m-0 text-sm font-medium">{account.full_name || 'Name not provided'}{protectedAccount && <span className="ml-1 text-[#5f6b63]">◇</span>}</p><p className="m-0 text-[11px] text-[#5f6b63]">{account.email}</p></div></div></td><td className="px-4"><AdminBadge>{account.role}</AdminBadge></td><td className="px-4"><AdminBadge status={account.disabled_at ? 'archived' : 'active'}>{account.disabled_at ? 'Archived' : 'Active'}</AdminBadge></td><td className="px-4 text-xs text-[#5f6b63]">{formatDate(account.created_at)}</td><td className="px-4 text-xs text-[#5f6b63]">—</td><td className="px-4 text-right">{protectedAccount ? <span className="text-[11px] text-[#5f6b63]">Protected</span> : <button className="text-xs text-[#5f6b63] opacity-0 group-hover:opacity-100" disabled={saving} onClick={() => setTarget({ action: account.disabled_at ? 'restore' : 'archive', account })} type="button">{account.disabled_at ? 'Restore' : 'Archive'}</button>}</td></tr> })}</tbody>
        </table>
        {filtered.length === 0 && <p className="m-0 p-12 text-center text-sm text-[#5f6b63]">No accounts found.</p>}
      </div>
      {loading && <p className="m-0 p-5 text-xs text-[#5f6b63]">Loading accounts...</p>}
      <CreateAccountModal onClose={() => setCreateOpen(false)} onCreate={createAccount} open={createOpen} />
      <ConfirmAccountModal account={target?.account} action={target?.action} onClose={() => setTarget(null)} onConfirm={confirmTarget} />
    </section>
  )
}
