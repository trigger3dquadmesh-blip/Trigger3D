import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../../auth/useAuth.js'
import { isDemoMode, supabase } from '../../lib/supabase.js'

export default function AdminSettings() {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function openSettings() {
    setName(profile?.full_name || '')
    setEmail(profile?.email || user?.email || '')
    setMessage('')
    setError('')
    setOpen(true)
  }

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

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: trimmedName })
      .eq('id', user.id)

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
      setMessage('Administrator username saved.')
    }

    await refreshProfile()
    setSaving(false)
  }

  async function handleSignOut() {
    const { error: signOutError } = await signOut()
    if (signOutError) {
      setError(signOutError.message)
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <>
      <button aria-label="Open admin settings" className="admin-settings-toggle" onClick={openSettings} title="Admin settings" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.2-3.5a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L14.5 3h-4l-.3 2.4a8.2 8.2 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 1.9 1.1l.3 2.4h4l.3-2.4a8.2 8.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" /></svg>
      </button>
      {open && (
        <div className="settings-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <aside aria-label="Admin settings" className="admin-settings-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-heading">
              <div><p className="eyebrow">Administrator</p><h2>Account settings</h2></div>
              <button aria-label="Close settings" className="icon-button" onClick={() => setOpen(false)} type="button">×</button>
            </div>
            <form className="admin-settings-form" onSubmit={saveProfile}>
              <label>Username<input minLength="2" onChange={(event) => setName(event.target.value)} required value={name} /></label>
              <label>Email address<input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
              <p className="settings-help">Changing your email requires confirmation through the new inbox.</p>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              {message && <div className="alert alert-success" role="status">{message}</div>}
              <button className="button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save changes'}</button>
            </form>
            <section className="settings-security"><h3>Password</h3><p>Use a secure, unique password for this administrator account.</p><div className="settings-account-actions"><Link to="/change-password" onClick={() => setOpen(false)}>Change password</Link><button onClick={handleSignOut} type="button">Sign out</button></div></section>
          </aside>
        </div>
      )}
    </>
  )
}
