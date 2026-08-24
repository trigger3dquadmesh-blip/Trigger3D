import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../../auth/useAuth.js'
import { isDemoMode, supabase } from '../../lib/supabase.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'

export default function AdminSettings({ roleName = 'Administrator', sidebar = false, page = false, active = false, standalone = false }) {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(profile?.email || user?.email || '')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useAutoDismissNotice(message, () => setMessage(''))

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setError('Enter a username with at least 2 characters.')
      setSaving(false)
      return
    }

    if (isDemoMode) {
      setMessage('Settings changes require a Supabase connection.')
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase.rpc('set_own_full_name', {
      new_full_name: trimmedName,
    })

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    if (email.trim().toLowerCase() !== user.email?.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() })
      if (emailError) {
        setError(`Username updated, but email could not be changed: ${emailError.message}`)
        await refreshProfile()
        setSaving(false)
        return
      }
      setMessage('Username saved. Check your new email address to confirm the email change.')
    } else {
      setMessage(`${roleName} username saved.`)
    }

    await refreshProfile()
    setSaving(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    setError('')
    const { error: signOutError } = await signOut()
    if (signOutError) {
      setError(signOutError.message)
      setSigningOut(false)
      return
    }
    // Clear the protected-page destination so the next account starts at its overview.
    navigate('/login', { replace: true, state: {} })
  }

  if (sidebar) {
    return (
      <button aria-current={active ? 'page' : undefined} aria-label={`Open ${roleName.toLowerCase()} settings`} className={`admin-settings-toggle sidebar-settings-toggle${active ? ' active' : ''}`} onClick={() => navigate('/settings')} title={`${roleName} settings`} type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.2-3.5a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L14.5 3h-4l-.3 2.4a8.2 8.2 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 1.9 1.1l.3 2.4h4l.3-2.4a8.2 8.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" /></svg>
        <span>Account settings</span>
      </button>
    )
  }

  if (!page) return null

  return (
    <>
      <article className={`${standalone ? 'card auth-card' : 'dashboard-card dashboard-card-wide'} account-settings-page`}>
        <div className="settings-heading">
          <div><p className="eyebrow">{roleName}</p><h2>Account settings</h2></div>
        </div>
        <form className="admin-settings-form" onSubmit={saveProfile}>
          <label>Username<input minLength="2" onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <label>Email address<input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <p className="settings-help">Changing your email requires confirmation through the new inbox.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}
          <button className="button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
        <section className="settings-security"><h3>Password</h3><p>Use a secure, unique password for this account.</p><div className="settings-account-actions"><Link to="/change-password">Change password</Link><button onClick={() => setConfirmSignOut(true)} type="button">Sign out</button></div></section>
      </article>
      {confirmSignOut && (
        <div aria-modal="true" className="confirmation-backdrop" role="dialog">
          <section className="confirmation-dialog" aria-labelledby="sign-out-title">
            <p className="eyebrow">Account</p>
            <h2 id="sign-out-title">Sign out?</h2>
            <p>You will need to sign in again to continue using Trigger3D.</p>
            <div className="confirmation-actions">
              <button className="danger-action" disabled={signingOut} onClick={handleSignOut} type="button">{signingOut ? 'Signing out...' : 'Sign out'}</button>
              <button className="secondary-action" disabled={signingOut} onClick={() => setConfirmSignOut(false)} type="button">Cancel</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
