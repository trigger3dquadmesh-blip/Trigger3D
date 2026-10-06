import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getVerifiedTotpFactors, normalizeMfaCode } from '../auth/mfa.js'
import useAuth from '../auth/useAuth.js'
import { getRoleHomePath } from '../config/roles.js'
import { supabase } from '../lib/supabase.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function MfaVerificationPage() {
  const { role, signOut, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.mfa.listFactors().then(({ data, error: factorError }) => {
      if (!active) return
      const factors = getVerifiedTotpFactors(data)
      setFactor(factors[0] || null)
      setError(factorError?.message || (!factors.length ? 'No verified authenticator is available for this account.' : ''))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  if (!user) return <Navigate replace to="/login" />
  if (!['admin', 'faculty'].includes(role)) return <Navigate replace to={getRoleHomePath(role)} />

  const roleLabel = role === 'faculty' ? 'Faculty' : 'Administrator'

  async function verify(event) {
    event.preventDefault()
    if (!factor || code.length !== 6) return
    setSubmitting(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (verifyError) {
      setError('The verification code is incorrect or expired. Try the current code from your authenticator app.')
      setCode('')
      setSubmitting(false)
      return
    }
    await supabase.auth.refreshSession()
    navigate(location.state?.from || getRoleHomePath(role), { replace: true })
  }

  async function cancel() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="auth-screen grid min-h-screen place-items-center bg-[var(--auth-bg)] px-4 py-5 text-[var(--auth-text)]">
      <section className="relative w-full max-w-[28rem] rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-5 pt-16 shadow-[0_24px_70px_rgb(0_0_0/0.24)] sm:p-6 sm:pt-16">
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6"><ThemeToggle compact /></div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#109d1a]">{roleLabel} security</p>
        <h1 className="m-0 text-3xl font-black leading-none tracking-tight">Verify your identity</h1>
        <p className="mb-5 mt-3 text-sm leading-6 text-[var(--auth-muted)]">Enter the six-digit code from your authenticator app to open your {roleLabel.toLowerCase()} account.</p>
        {loading ? <p>Loading authenticator…</p> : (
          <form className="grid gap-3" onSubmit={verify}>
            <label className="grid gap-1.5 text-sm font-bold" htmlFor="mfa-code">Authentication code
              <input autoComplete="one-time-code" className="h-[52px] rounded-lg border border-[var(--auth-border)] bg-[var(--auth-input)] px-4 text-center text-xl tracking-[0.35em] outline-none focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20" disabled={submitting || !factor} id="mfa-code" inputMode="numeric" maxLength="6" onChange={(event) => setCode(normalizeMfaCode(event.target.value))} pattern="[0-9]{6}" required value={code} />
            </label>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <button className="auth-primary-action min-h-12 cursor-pointer rounded-lg border-0 bg-[#109d1a] px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || !factor || code.length !== 6} type="submit">{submitting ? 'Verifying…' : 'Verify and continue'}</button>
            <button className="secondary-action cursor-pointer disabled:cursor-not-allowed" disabled={submitting} onClick={cancel} type="button">Sign out</button>
          </form>
        )}
      </section>
    </main>
  )
}
