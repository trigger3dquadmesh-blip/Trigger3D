import { Navigate } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import { getRoleHomePath } from '../config/roles.js'
import DashboardLoading from './DashboardLoading.jsx'

export default function RoleProtectedRoute({ allowedRole, children }) {
  const { loading, profileError, role } = useAuth()

  if (loading) {
    return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading your account…" /></main>
  }

  if (profileError || !role) {
    return <Navigate to="/account" replace />
  }

  if (role !== allowedRole) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return children
}
