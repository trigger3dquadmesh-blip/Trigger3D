import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { validatePasswordChange } from '../auth/password.js'
import useAuth from '../auth/useAuth.js'
import DashboardLoading from '../components/DashboardLoading.jsx'
import { getRoleHomePath } from '../config/roles.js'
import { supabase } from '../lib/supabase.js'

export default function ChangePasswordPage() {
  const { loading, role, user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (loading) return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading your account…" /></main>
  if (!role) return <Navigate to="/account" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const validationError = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    const { error: verificationError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (verificationError) {
      setError('Your current password is incorrect.')
      setSubmitting(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Your password was changed successfully. Use it the next time you sign in.')
    }
    setSubmitting(false)
  }

  return (
    <main className="page auth-page">
      <section className="card auth-card change-password-card">
        <p className="eyebrow">Account security</p>
        <h1>Change password</h1>
        <p>Confirm your current password, then choose a new password containing at least 8 characters.</p>
        <p className="account-email">{user.email}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="current-password">Current password</label>
          <input
            autoComplete="current-password"
            disabled={submitting}
            id="current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />

          <label htmlFor="new-password">New password</label>
          <input
            autoComplete="new-password"
            disabled={submitting}
            id="new-password"
            minLength="8"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />

          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input
            autoComplete="new-password"
            disabled={submitting}
            id="confirm-new-password"
            minLength="8"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />

          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}

          <button className="button submit-button" disabled={submitting} type="submit">
            {submitting ? 'Changing password...' : 'Change password'}
          </button>
        </form>

        <Link className="text-link" to={getRoleHomePath(role)}>Return to dashboard</Link>
      </section>
    </main>
  )
}
