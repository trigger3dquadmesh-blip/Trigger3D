import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="page status-page">Checking your session…</main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
