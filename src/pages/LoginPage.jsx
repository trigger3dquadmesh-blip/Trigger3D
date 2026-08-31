import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { isAllowedStudentEmail, normalizeEmail } from '../auth/email.js'
import { isValidFullName, normalizeFullName } from '../auth/name.js'
import useAuth from '../auth/useAuth.js'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { isDemoMode, supabase } from '../lib/supabase.js'

const allowedDomain = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'parsu.edu.ph'
).replace(/^@/, '')

const inputClass = 'peer h-11 w-full rounded-lg border border-[var(--auth-border)] bg-[var(--auth-input)] px-4 pb-1 pt-4 text-[var(--auth-text)] outline-none transition placeholder:text-transparent focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20 disabled:cursor-not-allowed disabled:opacity-60'
const labelClass = 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--auth-muted)] transition-all peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[0.68rem] peer-focus:font-bold peer-focus:text-[#109d1a] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[0.68rem] peer-[:not(:placeholder-shown)]:font-bold'

export default function LoginPage() {
  const { demoSignIn, isConfigured, loading: sessionLoading, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  )
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
    setShowPassword(false)
    setShowConfirmPassword(false)
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
    <main className="auth-screen grid min-h-screen place-items-center bg-[var(--auth-bg)] px-4 py-3 text-[var(--auth-text)] sm:px-6 sm:py-5">
      <section className="w-full max-w-[28rem] rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-5 shadow-[0_24px_70px_rgb(0_0_0/0.24)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <Link className="grid h-10 w-10 place-items-center rounded-full border border-[var(--auth-border)] text-[var(--auth-muted)] transition hover:border-[#109d1a] hover:text-[#109d1a]" to="/" aria-label="Back to home" title="Back to home">
            <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <ThemeToggle compact />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#109d1a]">Trigger3D</p>
        <h1 className="m-0 text-3xl font-black leading-none tracking-tight text-[var(--auth-text)]">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="mb-0 mt-3 text-sm leading-6 text-[var(--auth-muted)]">
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

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="relative">
              <input
                className={inputClass}
                id="full-name"
                name="full-name"
                type="text"
                placeholder=" "
                autoComplete="name"
                minLength="2"
                maxLength="100"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={submitting}
                required
              />
              <label className={labelClass} htmlFor="full-name">Full name</label>
            </div>
          )}

          <div className="relative">
            <input className={inputClass} id="email" name="email" type="email" placeholder=" " autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required />
            <label className={labelClass} htmlFor="email">Email address</label>
          </div>

          <div className="relative">
            <input className={`${inputClass} pr-12`} id="password" name="password" placeholder=" " type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} required />
            <label className={labelClass} htmlFor="password">Password</label>
            <button className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-[var(--auth-muted)] hover:bg-[#109d1a]/10 hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-[#109d1a]" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={showPassword ? 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 9 5.2 9 8s-3.8 8-9 8a9.7 9.7 0 0 1-5.3-1.6M6.1 6.1C3.9 7.6 3 10 3 12c0 1.1.5 2.3 1.3 3.5' : 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'} /></svg>
            </button>
          </div>

          {mode === 'signup' && (
            <div className="relative">
                <input className={`${inputClass} pr-12`} id="confirm-password" name="confirm-password" placeholder=" " type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={submitting} required />
                <label className={labelClass} htmlFor="confirm-password">Confirm password</label>
                <button className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-[var(--auth-muted)] hover:bg-[#109d1a]/10 hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-[#109d1a]" type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'} aria-pressed={showConfirmPassword}>
                  <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={showConfirmPassword ? 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 9 5.2 9 8s-3.8 8-9 8a9.7 9.7 0 0 1-5.3-1.6M6.1 6.1C3.9 7.6 3 10 3 12c0 1.1.5 2.3 1.3 3.5' : 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'} /></svg>
                </button>
            </div>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}

          <button
            className="mt-1 w-full rounded-lg border-0 bg-[#109d1a] px-5 py-3 font-black text-white transition hover:bg-[#0c7d15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#109d1a] disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!isConfigured || submitting || sessionLoading}
          >
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mb-0 mt-3 text-center text-xs leading-5 text-[var(--auth-muted)]">
          Faculty and administrator accounts are administrator-created.
        </p>
        <p className="mb-0 mt-2 text-center text-sm text-[var(--auth-muted)]">
          {mode === 'login' ? 'No student account yet?' : 'Already have an account?'}{' '}
          <button className="border-0 bg-transparent p-0 font-black text-[#109d1a] hover:underline" type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  )
}
