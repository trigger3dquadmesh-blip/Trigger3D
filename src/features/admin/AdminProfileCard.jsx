import { useEffect, useRef, useState } from 'react'
import useAuth from '../../auth/useAuth.js'

const maxPhotoSize = 2 * 1024 * 1024

function getInitials(name) {
  return (name || 'Admin')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AdminProfileCard({ roleLabel = 'System administrator' }) {
  const { profile, user } = useAuth()
  const inputRef = useRef(null)
  const storageKey = `trigger3d-avatar-${user?.id}`
  const [photo, setPhoto] = useState(() => localStorage.getItem(storageKey) || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isPhotoActionsOpen, setIsPhotoActionsOpen] = useState(false)

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  function updatePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (PNG, JPG, or WEBP).')
      return
    }

    if (file.size > maxPhotoSize) {
      setError('Choose an image smaller than 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = String(reader.result)
      try {
        localStorage.setItem(storageKey, image)
        setPhoto(image)
        setError('')
        setNotice('Profile photo updated.')
        setIsPhotoActionsOpen(false)
      } catch {
        setError('This image is too large to save in this browser.')
      }
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    localStorage.removeItem(storageKey)
    setPhoto('')
    setError('')
    setNotice('Profile photo removed.')
    setIsRemoveDialogOpen(false)
    setIsPhotoActionsOpen(false)
  }

  return (
    <section className="admin-profile-card" aria-label="Administrator profile">
      <div className="admin-avatar-stack">
        <div className="admin-avatar" aria-label="Profile photo">
          {photo ? <img alt="Profile" src={photo} /> : <span>{getInitials(profile?.full_name)}</span>}
        </div>
        <button
          aria-expanded={photo ? isPhotoActionsOpen : undefined}
          aria-label={photo ? 'Show profile photo actions' : 'Upload profile photo'}
          className="avatar-edit-button"
          onClick={() => {
            if (photo) setIsPhotoActionsOpen((value) => !value)
            else inputRef.current?.click()
          }}
          title={photo ? 'Photo options' : 'Upload photo'}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Zm13-12.7 1.2-1.2a1.7 1.7 0 0 1 2.4 2.4L19.4 6.2 17 3.8Z" /></svg>
        </button>
      </div>
      <strong>{profile?.full_name || 'Administrator'}</strong>
      <span>{profile?.email}</span>
      <small>{roleLabel}</small>
      <input accept="image/png,image/jpeg,image/webp" hidden onChange={updatePhoto} ref={inputRef} type="file" />
      {photo && isPhotoActionsOpen && (
        <div className="admin-photo-actions">
            <button onClick={() => inputRef.current?.click()} type="button">Change photo</button>
            <button className="subtle-action" onClick={() => setIsRemoveDialogOpen(true)} type="button">Remove</button>
        </div>
      )}
      {error && <span className="admin-profile-error" role="alert">{error}</span>}
      {notice && <span className="admin-profile-notice" role="status">{notice}</span>}
      {isRemoveDialogOpen && (
        <div className="confirmation-backdrop" role="presentation">
          <section aria-labelledby="remove-profile-photo-title" aria-modal="true" className="confirmation-dialog" role="dialog">
            <p className="eyebrow">Confirm action</p>
            <h2 id="remove-profile-photo-title">Remove profile photo?</h2>
            <p>Your current profile photo will be removed from this browser. You can upload a new one at any time.</p>
            <div className="confirmation-actions">
              <button className="danger-action" onClick={removePhoto} type="button">Remove photo</button>
              <button onClick={() => setIsRemoveDialogOpen(false)} type="button">Cancel</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
