import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { supabase } from '../lib/supabase.js'

const fieldClass = 'h-[52px] w-full rounded-lg border border-[var(--auth-border)] bg-[var(--auth-input)] px-4 text-[var(--auth-text)] outline-none focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/20 disabled:opacity-60'

function PasswordVisibilityButton({ visible, onToggle, label }) {
  return <button aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-[var(--auth-muted)] hover:bg-[#109d1a]/10 hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-[#109d1a]" onClick={onToggle} type="button"><svg aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><path d={visible ? 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 9 5.2 9 8s-3.8 8-9 8a9.7 9.7 0 0 1-5.3-1.6M6.1 6.1C3.9 7.6 3 10 3 12c0 1.1.5 2.3 1.3 3.5' : 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'} strokeLinecap="round" strokeLinejoin="round" /></svg></button>
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Your new password must contain at least 8 characters.')
    if (password !== confirmation) return setError('The passwords do not match.')

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'The reset link is invalid or has expired. Request a new link.')
      setSubmitting(false)
      return
    }
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return <main className="auth-screen grid min-h-screen place-items-center bg-[var(--auth-bg)] px-4 py-5 text-[var(--auth-text)]"><section className="w-full max-w-[28rem] rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-5 shadow-[0_24px_70px_rgb(0_0_0/0.24)] sm:p-6"><div className="mb-5 flex items-center justify-between"><Link aria-label="Return to login" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--auth-border)] text-[var(--auth-muted)] hover:border-[#109d1a] hover:text-[#109d1a]" to="/login"><svg aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><ThemeToggle compact /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#109d1a]">Account security</p><h1 className="m-0 text-3xl font-black leading-none tracking-tight">Choose a new password</h1><p className="mb-5 mt-3 text-sm leading-6 text-[var(--auth-muted)]">Use at least 8 characters and enter the same password twice.</p><form className="grid gap-3" onSubmit={handleSubmit}><div className="grid gap-1.5 text-sm font-bold"><label htmlFor="reset-password">New password</label><span className="relative"><input autoComplete="new-password" className={`${fieldClass} pr-12`} disabled={submitting} id="reset-password" minLength="8" onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} /><PasswordVisibilityButton label="new password" onToggle={() => setShowPassword((visible) => !visible)} visible={showPassword} /></span></div><div className="grid gap-1.5 text-sm font-bold"><label htmlFor="reset-password-confirmation">Confirm new password</label><span className="relative"><input autoComplete="new-password" className={`${fieldClass} pr-12`} disabled={submitting} id="reset-password-confirmation" minLength="8" onChange={(event) => setConfirmation(event.target.value)} required type={showConfirmation ? 'text' : 'password'} value={confirmation} /><PasswordVisibilityButton label="password confirmation" onToggle={() => setShowConfirmation((visible) => !visible)} visible={showConfirmation} /></span></div>{error && <div className="alert alert-error" role="alert">{error}</div>}<button className="auth-primary-action mt-1 min-h-12 w-full rounded-lg border-0 bg-[#109d1a] px-5 py-3 font-black text-white hover:bg-[#0c7d15] disabled:opacity-50" disabled={submitting} type="submit">{submitting ? 'Saving…' : 'Save new password'}</button></form></section></main>
}
