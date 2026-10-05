import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import { needsMfaVerification } from '../auth/mfa.js'
import { supabase } from '../lib/supabase.js'
import DashboardLoading from './DashboardLoading.jsx'

export default function AdminMfaGuard({ children }) {
  const { loading, role, user } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (loading || !user || role !== 'admin') {
      // Reset the previous administrator check when the signed-in account changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false)
      setRequiresVerification(false)
      return undefined
    }

    // Show a blocking state while the external assurance level is being checked.
    setChecking(true)
    setError('')
    Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]).then(([factorResult, assuranceResult]) => {
      if (!active) return
      if (factorResult.error || assuranceResult.error) {
        setError('Administrator security could not be verified. Refresh the page or sign in again.')
        setChecking(false)
        return
      }
      setRequiresVerification(needsMfaVerification({
        currentLevel: assuranceResult.data?.currentLevel,
        factors: factorResult.data,
        role,
      }))
      setChecking(false)
    }).catch(() => {
      if (!active) return
      setError('Administrator security could not be verified. Refresh the page or sign in again.')
      setChecking(false)
    })

    return () => { active = false }
  }, [loading, role, user])

  if (loading || checking) {
    return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Checking administrator security…" /></main>
  }

  if (error) {
    return <main className="page status-page"><section className="card auth-card"><h1>Security check unavailable</h1><p>{error}</p><button className="button" onClick={() => window.location.reload()} type="button">Try again</button></section></main>
  }

  if (requiresVerification) {
    return <Navigate replace state={{ from: location.pathname }} to="/mfa/verify" />
  }

  return children
}
