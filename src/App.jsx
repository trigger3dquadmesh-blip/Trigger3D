import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleProtectedRoute from './components/RoleProtectedRoute.jsx'
import AdminMfaGuard from './components/AdminMfaGuard.jsx'
import { ROLES } from './config/roles.js'
import ThemeToggle from './components/ThemeToggle.jsx'
import DashboardLoading from './components/DashboardLoading.jsx'

const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'))
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const MfaVerificationPage = lazy(() => import('./pages/MfaVerificationPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard.jsx'))
const FacultyDashboard = lazy(() => import('./features/faculty/FacultyDashboard.jsx'))
const StudentDashboard = lazy(() => import('./features/student/StudentDashboard.jsx'))
const StudentRouteShell = lazy(() => import('./features/student/StudentRouteShell.jsx'))
const FirearmViewerPage = lazy(
  () => import('./features/student/viewer/FirearmViewerPage.jsx'),
)
const AssessmentPage = lazy(
  () => import('./features/student/assessment/AssessmentPage.jsx'),
)

function RouteLoading() {
  return <main className="page status-page"><DashboardLoading className="dashboard-loading-route" label="Loading Trigger3D…" /></main>
}

export default function App() {
  const location = useLocation()
  const dashboardOwnsThemeToggle = ['/account', '/admin', '/faculty', '/settings'].includes(location.pathname) || location.pathname.startsWith('/student')

  return (
    <>
      {!['/', '/login', '/reset-password'].includes(location.pathname) && !dashboardOwnsThemeToggle && (
        <ThemeToggle compact={location.pathname.startsWith('/admin') || location.pathname === '/settings'} />
      )}
      <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/mfa/verify"
        element={
          <ProtectedRoute>
            <MfaVerificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AdminMfaGuard><SettingsPage /></AdminMfaGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.ADMIN}>
              <AdminMfaGuard><AdminDashboard /></AdminMfaGuard>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.FACULTY}>
              <AdminMfaGuard><FacultyDashboard /></AdminMfaGuard>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.STUDENT}>
              <StudentDashboard />
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/models/:firearmId"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.STUDENT}>
              <StudentRouteShell><FirearmViewerPage /></StudentRouteShell>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/models/:firearmId/assessment"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.STUDENT}>
              <StudentRouteShell><AssessmentPage /></StudentRouteShell>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
