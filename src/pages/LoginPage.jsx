import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { isAllowedStudentEmail, normalizeEmail } from '../auth/email.js'
import { isValidFullName, normalizeFullName } from '../auth/name.js'
import useAuth from '../auth/useAuth.js'
import { isDemoMode, supabase } from '../lib/supabase.js'

const allowedDomain = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'parsu.edu.ph'
).replace(/^@/, '')

export default function LoginPage() {
  const { demoSignIn, isConfigured, loading: sessionLoading, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!sessionLoading && user) {
    return <Navigate to="/account" replace />
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !password) {
      setError('Enter both your email address and password.')
      return
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.')
      return
    }

    if (mode === 'signup') {
      if (!isValidFullName(fullName)) {
        setError('Enter your full name using between 2 and 100 characters.')
        return
      }

      if (!isAllowedStudentEmail(normalizedEmail, allowedDomain)) {
        setError(`Student registration requires an @${allowedDomain} email address.`)
        return
      }

      if (password !== confirmPassword) {
        setError('The passwords do not match.')
        return
      }
    }

    setSubmitting(true)

    try {
      if (isDemoMode) {
        if (mode === 'signup') {
          throw new Error('Student registration requires a Supabase connection. Use the demo student account to preview the dashboard.')
        }
        const { error: demoError } = demoSignIn(email, password)
        if (demoError) throw demoError
        navigate('/account', { replace: true })
        return
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: {
              requested_role: 'student',
              full_name: normalizeFullName(fullName),
            },
          },
        })

        if (signUpError) throw signUpError

        if (data.session) {
          navigate('/account', { replace: true })
        } else {
          setNotice('Registration received. Check your school email to confirm your account.')
          setPassword('')
          setConfirmPassword('')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (signInError) throw signInError

        navigate('/account', { replace: true })
      }
    } catch (authError) {
      setError(authError.message || 'Authentication failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page auth-page">
      <section className="card auth-card">
        <p className="eyebrow">Trigger3D</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Student registration'}</h1>
        <p>
          {mode === 'login'
            ? 'Students, faculty, and administrators can sign in here.'
            : `Registration is available only to students with an @${allowedDomain} email.`}
        </p>

        {isDemoMode && (
          <div className="alert alert-success" role="status">
            <strong>Demo accounts</strong><br />
            Administrator: <strong>admin@trigger3d.demo</strong><br />
            Student: <strong>student@trigger3d.demo</strong><br />
            Faculty: <strong>faculty@trigger3d.demo</strong><br />
            Password for all: <strong>demo12345</strong>
          </div>
        )}

        {!isConfigured && (
          <div className="alert alert-error" role="alert">
            Supabase is not configured. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart Vite.
          </div>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Authentication method">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => switchMode('signup')}
          >
            Student registration
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label htmlFor="full-name">Full name</label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                autoComplete="name"
                minLength="2"
                maxLength="100"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={submitting}
                required
              />
            </>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength="8"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            required
          />

          {mode === 'signup' && (
            <>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength="8"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
                required
              />
            </>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}

          <button
            className="button submit-button"
            type="submit"
            disabled={!isConfigured || submitting || sessionLoading}
          >
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create student account'}
          </button>
        </form>

        <p className="auth-note">
          Faculty and administrator accounts must be created by an administrator.
        </p>
        <Link className="text-link" to="/">Back to home</Link>
      </section>
    </main>
  )
}
