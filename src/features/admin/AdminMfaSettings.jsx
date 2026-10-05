import { useEffect, useState } from 'react'
import { getVerifiedTotpFactors, normalizeMfaCode } from '../../auth/mfa.js'
import { supabase } from '../../lib/supabase.js'

export default function AdminMfaSettings() {
  const [factors, setFactors] = useState([])
  const [pendingFactor, setPendingFactor] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadFactors() {
    const { data, error: factorError } = await supabase.auth.mfa.listFactors()
    setFactors(getVerifiedTotpFactors(data))
    setError(factorError?.message || '')
    setLoading(false)
  }

  useEffect(() => {
    // Load the account's external Supabase factors when settings open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFactors()
  }, [])

  async function beginEnrollment() {
    setWorking(true)
    setError('')
    setMessage('')
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: factors.length ? `Trigger3D backup ${factors.length + 1}` : 'Trigger3D administrator',
    })
    if (enrollError) setError(enrollError.message)
    else setPendingFactor(data)
    setWorking(false)
  }

  async function verifyEnrollment(event) {
    event.preventDefault()
    if (!pendingFactor || code.length !== 6) return
    setWorking(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactor.id,
      code,
    })
    if (verifyError) {
      setError('The code is incorrect or expired. Enter the current six-digit code.')
      setCode('')
      setWorking(false)
      return
    }
    await supabase.auth.refreshSession()
    setPendingFactor(null)
    setCode('')
    setMessage('Authenticator enabled. It will be required the next time this administrator signs in.')
    await loadFactors()
    setWorking(false)
  }

  async function cancelEnrollment() {
    if (pendingFactor?.id) await supabase.auth.mfa.unenroll({ factorId: pendingFactor.id })
    setPendingFactor(null)
    setCode('')
    setError('')
  }

  async function removeFactor(factorId) {
    setWorking(true)
    setError('')
    setMessage('')
    const { error: removalError } = await supabase.auth.mfa.unenroll({ factorId })
    if (removalError) setError(removalError.message)
    else {
      setMessage('Authenticator removed.')
      await loadFactors()
    }
    setWorking(false)
  }

  return <section className="account-settings-page settings-password-card"><h2>Two-factor authentication</h2><p>Protect administrator controls with a six-digit code from Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.</p>{error && <div className="alert alert-error" role="alert">{error}</div>}{message && <div className="alert alert-success" role="status">{message}</div>}{loading ? <p>Checking authenticators…</p> : pendingFactor ? <form className="admin-settings-form" onSubmit={verifyEnrollment}><div className="settings-password-grid"><div><strong>1. Scan this QR code</strong><p>Open your authenticator app, add an account, then scan the image.</p><img alt="Authenticator enrollment QR code" className="mt-2 h-44 w-44 rounded-lg bg-white p-2" src={pendingFactor.totp.qr_code} /></div><div><strong>2. Verify the current code</strong><label>Six-digit code<input autoComplete="one-time-code" disabled={working} inputMode="numeric" maxLength="6" onChange={(event) => setCode(normalizeMfaCode(event.target.value))} pattern="[0-9]{6}" required value={code} /></label><div className="settings-save-row"><button className="button" disabled={working || code.length !== 6} type="submit">{working ? 'Verifying…' : 'Enable authenticator'}</button><button className="secondary-action" disabled={working} onClick={cancelEnrollment} type="button">Cancel</button></div></div></div></form> : <><p>{factors.length ? `${factors.length} verified authenticator${factors.length === 1 ? '' : 's'} connected.` : 'No authenticator is connected yet.'}</p>{factors.map((factor, index) => <div className="settings-save-row" key={factor.id}><span>{factor.friendly_name || `Authenticator ${index + 1}`}</span><button className="danger-action" disabled={working} onClick={() => removeFactor(factor.id)} type="button">Remove</button></div>)}<div className="settings-save-row"><button className="button" disabled={working} onClick={beginEnrollment} type="button">{factors.length ? 'Add backup authenticator' : 'Set up authenticator'}</button></div>{factors.length === 1 && <p className="text-sm text-[var(--muted)]">Supabase does not provide recovery codes. Add a backup authenticator before requiring MFA for every administrator.</p>}</>}</section>
}
