import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'

export default function RoleDashboard({ title, description, children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    setError('')

    const { error: signOutError } = await signOut()

    if (signOutError) {
      setError(signOutError.message)
      setSigningOut(false)
      return
    }

    navigate('/login', { replace: true })
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Trigger3D</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="dashboard-user">
          <strong>{profile.full_name || 'Name not provided'}</strong>
          <span>{profile.email}</span>
          <div className="dashboard-user-actions">
            <Link to="/change-password">Change password</Link>
            <button type="button" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="dashboard-grid">{children}</section>
    </main>
  )
}
