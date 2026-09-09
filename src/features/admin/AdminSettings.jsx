import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../auth/useAuth.js'
import { supabase } from '../../lib/supabase.js'
import useAutoDismissNotice from '../../components/useAutoDismissNotice.js'
import AdminIcon from './AdminIcon.jsx'
import { validatePasswordChange } from '../../auth/password.js'
import { getAvatarStoragePath } from '../../auth/profile-avatar.js'

export default function AdminSettings({ roleName = 'Administrator', sidebar = false, profileMenu = false, page = false, active = false, standalone = false }) {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
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
  const photoMenuRef = useRef(null)
  const profileMenuButtonRef = useRef(null)
  const profileMenuRef = useRef(null)
  const [photo, setPhoto] = useState(() => profile?.avatar_url || '')
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
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

  useEffect(() => {
    if (!photoMenuOpen) return undefined
    function closePhotoMenu(event) {
      if (!photoMenuRef.current?.contains(event.target)) setPhotoMenuOpen(false)
    }
    function closePhotoMenuWithKeyboard(event) {
      if (event.key === 'Escape') setPhotoMenuOpen(false)
    }
    document.addEventListener('pointerdown', closePhotoMenu)
    document.addEventListener('keydown', closePhotoMenuWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closePhotoMenu)
      document.removeEventListener('keydown', closePhotoMenuWithKeyboard)
    }
  }, [photoMenuOpen])

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

    const { error: profileError } = await supabase.rpc('set_own_full_name', {
      new_full_name: trimmedName,
    })

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    setMessage(`${roleName} username saved.`)

    await refreshProfile()
    setFullName(trimmedName)
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
    setPhotoMenuOpen(false)
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WebP image up to 2 MB.')
      return
    }
    setError('')
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `${user.id}/avatar-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('profile-photos').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const previousStoragePath = profile?.avatar_storage_path || getAvatarStoragePath(profile?.avatar_url)
    const { error: profilePhotoError } = await supabase.rpc('set_own_avatar_url', { new_avatar_url: storagePath })
    if (profilePhotoError) {
      setError(profilePhotoError.message)
      await supabase.storage.from('profile-photos').remove([storagePath])
      return
    }
    const refreshed = await refreshProfile()
    setPhoto(refreshed.data?.avatar_url || '')
    if (previousStoragePath && previousStoragePath !== storagePath) {
      await supabase.storage.from('profile-photos').remove([previousStoragePath])
    }
    setMessage('Profile photo updated.')
    event.target.value = ''
  }

  async function removePhoto() {
    setPhotoRemoving(true)
    setError('')
    setMessage('')

    const storagePath = profile?.avatar_storage_path || getAvatarStoragePath(profile?.avatar_url || photo)
    if (storagePath) {
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

    setPhoto('')
    await refreshProfile()
    setMessage('Profile photo removed.')
    setPhotoMenuOpen(false)
    setPhotoRemoving(false)
  }

  const signOutConfirmation = confirmSignOut ? createPortal(
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
    </div>,
    document.body,
  ) : null

  if (sidebar) {
    const menuDisplayName = profile?.full_name || roleName
    const menuInitials = menuDisplayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A'
    const menuPhoto = photo || profile?.avatar_url || ''
    return (
      <>
        <button aria-current={active ? 'page' : undefined} aria-expanded={profileMenu ? profileMenuOpen : undefined} aria-haspopup={profileMenu ? 'menu' : undefined} aria-label={`Open ${roleName.toLowerCase()} settings`} className={`admin-settings-toggle sidebar-settings-toggle${profileMenu ? ' profile-menu-toggle' : ''}${active ? ' active' : ''}`} onClick={() => profileMenu ? setProfileMenuOpen((value) => !value) : navigate('/settings')} ref={profileMenuButtonRef} title={`${roleName} settings`} type="button">
          {profileMenu ? <><span className="sidebar-menu-more"><AdminIcon name="more" /></span><span className="sidebar-account-avatar">{menuPhoto ? <img alt="" src={menuPhoto} /> : menuInitials}</span></> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.2-3.5a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L14.5 3h-4l-.3 2.4a8.2 8.2 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 1.9 1.1l.3 2.4h4l.3-2.4a8.2 8.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" /></svg>}
          <span>Account settings</span>
        </button>
        {profileMenu && profileMenuOpen && (
          <div className="admin-profile-options" ref={profileMenuRef} role="menu">
            <button onClick={() => { setProfileMenuOpen(false); navigate('/settings') }} role="menuitem" type="button">Account settings</button>
            <button onClick={toggleTheme} role="menuitem" type="button">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
            <button className="danger" onClick={() => { setProfileMenuOpen(false); setConfirmSignOut(true) }} role="menuitem" type="button">Sign out</button>
          </div>
        )}
        {profileMenu && signOutConfirmation}
      </>
    )
  }

  if (!page) return null

  const displayPhoto = photo || profile?.avatar_url || ''
  const accountEmail = user?.email || profile?.email || ''
  const profileName = profile?.full_name || ''
  const displayName = profileName || roleName
  const nameChanged = fullName.trim() !== profileName.trim()

  function handlePhotoEdit() {
    if (displayPhoto) setPhotoMenuOpen((value) => !value)
    else photoInputRef.current?.click()
  }

  return (
    <>
      <header className="account-settings-title"><p>Settings</p><h1>Account Settings</h1></header>
      <section className="account-settings-page settings-profile-photo">
        <h2>Profile Photo</h2>
        <div className="settings-photo-row"><div className="settings-photo-avatar-wrap" ref={photoMenuRef}><div className="settings-photo-avatar">{displayPhoto ? <img alt={`${displayName} profile`} src={displayPhoto} /> : <span>{displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A'}</span>}</div><button aria-expanded={displayPhoto ? photoMenuOpen : undefined} aria-haspopup={displayPhoto ? 'menu' : undefined} aria-label={displayPhoto ? 'Edit profile photo' : 'Choose profile photo'} className="settings-camera-button" disabled={photoRemoving} onClick={handlePhotoEdit} title={displayPhoto ? 'Edit profile photo' : 'Choose profile photo'} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16-.8 4 4-.8L18.5 7.9l-3.2-3.2L4 16Z" /><path d="m13.8 6.2 3.2 3.2" /></svg></button>{displayPhoto && photoMenuOpen && <div className="settings-photo-menu" role="menu"><button onClick={() => photoInputRef.current?.click()} role="menuitem" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></svg>Upload new photo</button><button className="danger" disabled={photoRemoving} onClick={removePhoto} role="menuitem" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>{photoRemoving ? 'Removing…' : 'Remove photo'}</button></div>}</div><div className="settings-photo-copy"><strong>{displayName}</strong><p>{accountEmail}</p><small>Profile photos may be JPG, PNG, or WebP up to 2 MB.</small></div><input accept="image/png,image/jpeg,image/webp" hidden onChange={updatePhoto} ref={photoInputRef} type="file" /></div>
      </section>
      <article className={`${standalone ? 'card auth-card' : 'dashboard-card dashboard-card-wide'} account-settings-page`}>
        <div className="settings-heading">
          <div><h2>Account Information</h2></div>
        </div>
        <form className="admin-settings-form" onSubmit={saveProfile}>
          <label>Full Name<input disabled={saving} minLength="2" onBlur={() => { if (fullName.trim().length < 2) setFullName(profileName) }} onChange={(event) => setFullName(event.target.value)} required value={fullName} /></label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}
          {nameChanged && <div className="settings-save-row"><button className="button" disabled={saving || fullName.trim().length < 2} type="submit">{saving ? 'Saving...' : 'Save Changes'}</button></div>}
        </form>
      </article>
      <section className="account-settings-page settings-password-card"><h2>Change Password</h2><form className="admin-settings-form" onSubmit={updatePassword}><label>Current Password<input autoComplete="current-password" disabled={passwordSaving} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label><div className="settings-password-grid"><label>New Password<input autoComplete="new-password" disabled={passwordSaving} minLength="8" onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={newPassword} /></label><label>Confirm Password<input autoComplete="new-password" disabled={passwordSaving} minLength="8" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter new password" required type="password" value={confirmPassword} /></label></div>{passwordError && <div className="alert alert-error" role="alert">{passwordError}</div>}{passwordMessage && <div className="alert alert-success" role="status">{passwordMessage}</div>}<div className="settings-save-row"><button className="button" disabled={passwordSaving} type="submit">{passwordSaving ? 'Updating...' : 'Update Password'}</button></div></form></section>
      {signOutConfirmation}
    </>
  )
}
