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
      <section className="card">
        <p className="eyebrow">Account setup required</p>
        <h1>Role unavailable</h1>
        <p>{profileError || 'This account does not have a valid Trigger3D role.'}</p>
        <p className="account-email">{user.email}</p>
        {signOutError && <div className="alert alert-error" role="alert">{signOutError}</div>}
        <button className="button" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </section>
    </main>
  )
}
