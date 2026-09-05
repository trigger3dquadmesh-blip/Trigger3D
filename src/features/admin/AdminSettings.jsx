import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../auth/useAuth.js'
import { isDemoMode, supabase } from '../../lib/supabase.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import AdminIcon from './AdminIcon.jsx'
import { validatePasswordChange } from '../../auth/password.js'

export default function AdminSettings({ roleName = 'Administrator', sidebar = false, profileMenu = false, page = false, active = false, standalone = false }) {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(profile?.email || user?.email || '')
  const [saving, setSaving] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || localStorage.getItem('trigger3d-theme') || 'dark')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const photoInputRef = useRef(null)
  const profileMenuButtonRef = useRef(null)
  const profileMenuRef = useRef(null)
  const photoStorageKey = `trigger3d-avatar-${user?.id}`
  const [photo, setPhoto] = useState(() => profile?.avatar_url || localStorage.getItem(photoStorageKey) || '')
  const [photoRemoving, setPhotoRemoving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useAutoDismissNotice(message, () => setMessage(''))

  useEffect(() => {
    if (!profileMenuOpen) return undefined

    function closeProfileMenu(event) {
      if (
        !profileMenuButtonRef.current?.contains(event.target)
        && !profileMenuRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false)
      }
    }

    function closeProfileMenuWithKeyboard(event) {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeProfileMenu)
    document.addEventListener('keydown', closeProfileMenuWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeProfileMenu)
      document.removeEventListener('keydown', closeProfileMenuWithKeyboard)
    }
  }, [profileMenuOpen])

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const trimmedName = fullName.trim()
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
    setEditingProfile(false)
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

  function toggleTheme() {
    const displayedTheme = document.documentElement.dataset.theme || localStorage.getItem('trigger3d-theme') || theme
    const nextTheme = displayedTheme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    localStorage.setItem('trigger3d-theme', nextTheme)
    setTheme(nextTheme)
  }

  async function updatePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    const validationError = validatePasswordChange({ currentPassword, newPassword, confirmPassword })
    if (validationError) {
      setPasswordError(validationError)
      return
    }
    setPasswordSaving(true)
    const { error: verificationError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (verificationError) {
      setPasswordError('Your current password is incorrect.')
      setPasswordSaving(false)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) setPasswordError(updateError.message)
    else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated successfully.')
    }
    setPasswordSaving(false)
  }

  async function updatePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WebP image up to 2 MB.')
      return
    }
    setError('')
    if (isDemoMode) {
      const reader = new FileReader()
      reader.onload = () => {
        const nextPhoto = String(reader.result)
        localStorage.setItem(photoStorageKey, nextPhoto)
        setPhoto(nextPhoto)
      }
      reader.readAsDataURL(file)
      return
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `${user.id}/avatar-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('profile-photos').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(storagePath)
    const nextPhoto = `${publicUrlData.publicUrl}?v=${Date.now()}`
    const { error: profilePhotoError } = await supabase.rpc('set_own_avatar_url', { new_avatar_url: nextPhoto })
    if (profilePhotoError) {
      setError(profilePhotoError.message)
      return
    }
    localStorage.setItem(photoStorageKey, nextPhoto)
    setPhoto(nextPhoto)
    setMessage('Profile photo updated.')
    await refreshProfile()
  }

  async function removePhoto() {
    setPhotoRemoving(true)
    setError('')
    setMessage('')

    if (isDemoMode) {
      localStorage.removeItem(photoStorageKey)
      setPhoto('')
      setMessage('Profile photo removed.')
      setPhotoRemoving(false)
      return
    }

    const storedUrl = profile?.avatar_url || photo
    const publicPathMarker = '/storage/v1/object/public/profile-photos/'
    const markerIndex = storedUrl.indexOf(publicPathMarker)
    if (markerIndex >= 0) {
      const encodedPath = storedUrl.slice(markerIndex + publicPathMarker.length).split('?')[0]
      const storagePath = decodeURIComponent(encodedPath)
      const { error: removalError } = await supabase.storage.from('profile-photos').remove([storagePath])
      if (removalError) {
        setError(removalError.message)
        setPhotoRemoving(false)
        return
      }
    }

    const { error: profilePhotoError } = await supabase.rpc('set_own_avatar_url', { new_avatar_url: null })
    if (profilePhotoError) {
      setError(profilePhotoError.message)
      setPhotoRemoving(false)
      return
    }

    localStorage.removeItem(photoStorageKey)
    setPhoto('')
    await refreshProfile()
    setMessage('Profile photo removed.')
    setPhotoRemoving(false)
  }

  if (sidebar) {
    return (
      <>
        <button aria-current={active ? 'page' : undefined} aria-expanded={profileMenu ? profileMenuOpen : undefined} aria-haspopup={profileMenu ? 'menu' : undefined} aria-label={`Open ${roleName.toLowerCase()} settings`} className={`admin-settings-toggle sidebar-settings-toggle${profileMenu ? ' profile-menu-toggle' : ''}${active ? ' active' : ''}`} onClick={() => profileMenu ? setProfileMenuOpen((value) => !value) : navigate('/settings')} ref={profileMenuButtonRef} title={`${roleName} settings`} type="button">
          {profileMenu ? <AdminIcon name="more" /> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.2-3.5a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L14.5 3h-4l-.3 2.4a8.2 8.2 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 1.9 1.1l.3 2.4h4l.3-2.4a8.2 8.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" /></svg>}
          <span>Account settings</span>
        </button>
        {profileMenu && profileMenuOpen && (
          <div className="admin-profile-options" ref={profileMenuRef} role="menu">
            <button onClick={() => { setProfileMenuOpen(false); navigate('/settings') }} role="menuitem" type="button">Account settings</button>
            <button onClick={toggleTheme} role="menuitem" type="button">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
            <button className="danger" onClick={() => { setProfileMenuOpen(false); setConfirmSignOut(true) }} role="menuitem" type="button">Sign out</button>
          </div>
        )}
        {profileMenu && confirmSignOut && (
          <div aria-modal="true" className="confirmation-backdrop" role="dialog">
            <section className="confirmation-dialog" aria-labelledby="sidebar-sign-out-title">
              <p className="eyebrow">Account</p>
              <h2 id="sidebar-sign-out-title">Sign out?</h2>
              <p>You will need to sign in again to continue using Trigger3D.</p>
              <div className="confirmation-actions">
                <button className="danger-action" disabled={signingOut} onClick={handleSignOut} type="button">{signingOut ? 'Signing out...' : 'Sign out'}</button>
                <button disabled={signingOut} onClick={() => setConfirmSignOut(false)} type="button">Cancel</button>
              </div>
            </section>
          </div>
        )}
      </>
    )
  }

  if (!page) return null

  return (
    <>
      <header className="account-settings-title"><p>Settings</p><h1>Account Settings</h1></header>
      <section className="account-settings-page settings-profile-photo">
        <h2>Profile Photo</h2>
        <div className="settings-photo-row"><div className="settings-photo-avatar-wrap"><div className="settings-photo-avatar">{photo ? <img alt="" src={photo} /> : <span>{fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A'}</span>}</div><button aria-label="Choose profile photo" className="settings-camera-button" onClick={() => photoInputRef.current?.click()} title="Choose profile photo" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" /><circle cx="12" cy="13" r="3.2" /></svg></button></div><div><strong>Upload a profile photo</strong><p>JPG, PNG, or WebP. Max 2 MB.</p><div className="settings-photo-actions"><button disabled={photoRemoving} onClick={() => photoInputRef.current?.click()} type="button">Choose file</button>{photo && <button className="settings-remove-photo" disabled={photoRemoving} onClick={removePhoto} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>{photoRemoving ? 'Removing…' : 'Remove photo'}</button>}<input accept="image/png,image/jpeg,image/webp" hidden onChange={updatePhoto} ref={photoInputRef} type="file" /></div></div></div>
      </section>
      <article className={`${standalone ? 'card auth-card' : 'dashboard-card dashboard-card-wide'} account-settings-page`}>
        <div className="settings-heading">
          <div><h2>Account Information</h2></div>
        </div>
        <form className="admin-settings-form" onSubmit={saveProfile}>
          <label>Full Name<input disabled={!editingProfile || saving} minLength="2" onChange={(event) => setFullName(event.target.value)} required value={fullName} /></label>
          <label>Email Address<input disabled={!editingProfile || saving} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}
          <div className="settings-save-row">{editingProfile ? <><button className="settings-cancel-button" disabled={saving} onClick={() => { setFullName(profile?.full_name || ''); setEmail(profile?.email || user?.email || ''); setEditingProfile(false) }} type="button">Cancel</button><button className="button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Changes'}</button></> : <button className="button settings-edit-button" onClick={() => setEditingProfile(true)} type="button">Edit</button>}</div>
        </form>
      </article>
      <section className="account-settings-page settings-password-card"><h2>Change Password</h2><form className="admin-settings-form" onSubmit={updatePassword}><label>Current Password<input autoComplete="current-password" disabled={passwordSaving} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label><div className="settings-password-grid"><label>New Password<input autoComplete="new-password" disabled={passwordSaving} minLength="8" onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={newPassword} /></label><label>Confirm Password<input autoComplete="new-password" disabled={passwordSaving} minLength="8" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter new password" required type="password" value={confirmPassword} /></label></div>{passwordError && <div className="alert alert-error" role="alert">{passwordError}</div>}{passwordMessage && <div className="alert alert-success" role="status">{passwordMessage}</div>}<div className="settings-save-row"><button className="button" disabled={passwordSaving} type="submit">{passwordSaving ? 'Updating...' : 'Update Password'}</button></div></form></section>
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
