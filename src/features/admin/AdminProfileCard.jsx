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

export default function AdminProfileCard() {
  const { profile, user } = useAuth()
  const inputRef = useRef(null)
  const storageKey = `trigger3d-avatar-${user?.id}`
  const [photo, setPhoto] = useState(() => localStorage.getItem(storageKey) || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
      } catch {
        setError('This image is too large to save in this browser.')
      }
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    if (!window.confirm('Remove your current profile photo? This cannot be undone.')) return

    localStorage.removeItem(storageKey)
    setPhoto('')
    setError('')
    setNotice('Profile photo removed.')
  }

  return (
    <section className="admin-profile-card" aria-label="Administrator profile">
      <div className="admin-avatar" aria-label="Administrator profile photo">
        {photo ? <img alt="Administrator" src={photo} /> : <span>{getInitials(profile?.full_name)}</span>}
      </div>
      <strong>{profile?.full_name || 'Administrator'}</strong>
      <span>{profile?.email}</span>
      <small>System administrator</small>
      <input accept="image/png,image/jpeg,image/webp" hidden onChange={updatePhoto} ref={inputRef} type="file" />
      <div className="admin-photo-actions">
        <button onClick={() => inputRef.current?.click()} type="button">Change photo</button>
        {photo && <button className="subtle-action" onClick={removePhoto} type="button">Remove</button>}
      </div>
      {error && <span className="admin-profile-error" role="alert">{error}</span>}
      {notice && <span className="admin-profile-notice" role="status">{notice}</span>}
    </section>
  )
}
