import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import { getRoleHomePath } from '../config/roles.js'
import DashboardLoading from '../components/DashboardLoading.jsx'

export default function AccountPage() {
  const { loading, profileError, role, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  if (loading) {
    return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading your account…" /></main>
  }

  if (role) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')
    const { error } = await signOut()

    if (error) {
      setSignOutError(error.message)
      setSigningOut(false)
      return
    }

    navigate('/login', { replace: true })
  }

  return (
    <main className="page account-page">
      <section className="account-setup-card">
        <span className="account-setup-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 9v4m0 3h.01M10.2 4.8 3.4 17a2 2 0 0 0 1.8 3h13.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" /></svg>
        </span>
        <p className="account-setup-eyebrow">Account setup required</p>
        <h1>{profileError ? 'Account access unavailable' : 'Your account needs a role'}</h1>
        <p className="account-setup-description">
          {profileError
            ? 'We could not finish loading your Trigger3D account access. Sign out and try again, or contact an administrator if the problem continues.'
            : 'An administrator must assign this account a student, faculty, or administrator role before you can continue.'}
        </p>
        <div className="account-setup-identity">
          <span>Signed-in account</span>
          <strong>{user.email}</strong>
        </div>
        {signOutError && <div className="alert alert-error" role="alert">{signOutError}</div>}
        <button className="account-setup-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </section>
    </main>
  )
}
