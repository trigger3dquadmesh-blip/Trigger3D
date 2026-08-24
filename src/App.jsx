import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleProtectedRoute from './components/RoleProtectedRoute.jsx'
import { ROLES } from './config/roles.js'
import AdminDashboard from './features/admin/AdminDashboard.jsx'
import FacultyDashboard from './features/faculty/FacultyDashboard.jsx'
import StudentDashboard from './features/student/StudentDashboard.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import AccountPage from './pages/AccountPage.jsx'
import ChangePasswordPage from './pages/ChangePasswordPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

const FirearmViewerPage = lazy(
  () => import('./features/student/viewer/FirearmViewerPage.jsx'),
)
const AssessmentPage = lazy(
  () => import('./features/student/assessment/AssessmentPage.jsx'),
)

export default function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
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
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.ADMIN}>
              <AdminDashboard />
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.FACULTY}>
              <FacultyDashboard />
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
              <Suspense fallback={<main className="page status-page">Loading viewer...</main>}>
                <FirearmViewerPage />
              </Suspense>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/models/:firearmId/assessment"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute allowedRole={ROLES.STUDENT}>
              <Suspense fallback={<main className="page status-page">Loading assessment...</main>}>
                <AssessmentPage />
              </Suspense>
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </>
  )
}
