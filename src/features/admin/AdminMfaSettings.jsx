import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getVerifiedTotpFactors, normalizeMfaCode } from '../../auth/mfa.js'
import { supabase } from '../../lib/supabase.js'

export default function AdminMfaSettings({ roleName = 'Administrator' }) {
  const [factors, setFactors] = useState([])
  const [pendingFactor, setPendingFactor] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [factorPendingRemoval, setFactorPendingRemoval] = useState(null)

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
      friendlyName: factors.length ? `Trigger3D backup ${factors.length + 1}` : `Trigger3D ${roleName.toLowerCase()}`,
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
    await supabase.rpc('record_my_security_event', { event_name: 'MFA authenticator added' })
    setPendingFactor(null)
    setCode('')
    setMessage(`Authenticator enabled. It will be required the next time this ${roleName.toLowerCase()} signs in.`)
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
    if (factors.length <= 1) {
      setFactorPendingRemoval(null)
      setError('Admin and faculty accounts must keep at least one authenticator. Add a backup authenticator before removing this one.')
      return
    }
    setWorking(true)
    setError('')
    setMessage('')
    const { error: removalError } = await supabase.auth.mfa.unenroll({ factorId })
    if (removalError) setError(removalError.message)
    else {
      await supabase.rpc('record_my_security_event', { event_name: 'MFA authenticator removed' })
      setMessage('Authenticator removed.')
      setFactorPendingRemoval(null)
      await loadFactors()
    }
    setWorking(false)
  }

  return (
    <section className="account-settings-page settings-password-card admin-mfa-card">
      <div className="admin-mfa-heading">
        <span className="admin-mfa-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.9 8.7 7 10 4.1-1.3 7-5.4 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.6-4" /></svg>
        </span>
        <div>
          <h2>Two-factor authentication</h2>
          <p>Add an extra layer of protection to your {roleName.toLowerCase()} account using a six-digit code from your authenticator app.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {!loading && factors.length === 0 && !pendingFactor && (
        <div className="admin-mfa-recovery-note" role="alert">
          <strong>Setup required</strong>
          <p>Two-factor authentication is required before this {roleName.toLowerCase()} account can open protected system pages.</p>
        </div>
      )}

      {loading ? (
        <p className="admin-mfa-loading">Checking connected authenticators…</p>
      ) : pendingFactor ? (
        <form className="admin-mfa-setup" onSubmit={verifyEnrollment}>
          <section className="admin-mfa-step" aria-labelledby="mfa-scan-title">
            <div className="admin-mfa-step-heading">
              <span>1</span>
              <div>
                <h3 id="mfa-scan-title">Scan the QR code</h3>
                <p>Open Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app and add a new account.</p>
              </div>
            </div>
            <div className="admin-mfa-qr-frame">
              <img alt="Authenticator enrollment QR code" src={pendingFactor.totp.qr_code} />
            </div>
            <p className="admin-mfa-step-note">Keep this screen open until setup is complete.</p>
          </section>

          <section className="admin-mfa-step" aria-labelledby="mfa-verify-title">
            <div className="admin-mfa-step-heading">
              <span>2</span>
              <div>
                <h3 id="mfa-verify-title">Verify your authenticator</h3>
                <p>Enter the current six-digit code shown in the app to finish connecting it.</p>
              </div>
            </div>
            <label className="admin-mfa-code-field" htmlFor="mfa-enrollment-code">
              Authentication code
              <input
                autoComplete="one-time-code"
                disabled={working}
                id="mfa-enrollment-code"
                inputMode="numeric"
                maxLength="6"
                onChange={(event) => setCode(normalizeMfaCode(event.target.value))}
                pattern="[0-9]{6}"
                placeholder="000000"
                required
                value={code}
              />
              <small>{code.length}/6 digits entered</small>
            </label>
            <div className="admin-mfa-actions">
              <button className="button" disabled={working || code.length !== 6} type="submit">
                {working ? 'Verifying…' : 'Enable authenticator'}
              </button>
              <button className="settings-cancel-button" disabled={working} onClick={cancelEnrollment} type="button">Cancel setup</button>
            </div>
          </section>
        </form>
      ) : (
        <>
          <div className="admin-mfa-status-row">
            <span className={`admin-mfa-status-badge ${factors.length ? 'is-enabled' : ''}`}>{factors.length ? 'Enabled' : 'Not configured'}</span>
            <p>{factors.length ? `${factors.length} verified authenticator${factors.length === 1 ? '' : 's'} connected to this account.` : 'No authenticator is connected yet.'}</p>
          </div>

          {factors.length > 0 && (
            <div className="admin-mfa-factor-list">
              {factors.map((factor, index) => {
                const factorName = factor.friendly_name || `Authenticator ${index + 1}`
                return (
                  <article key={factor.id}>
                    <div className="admin-mfa-factor-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2" /><path d="M10 5.5h4M11.5 18.5h1" /></svg>
                    </div>
                    <div className="admin-mfa-factor-copy">
                      <strong>{factorName}</strong>
                      <span>Authenticator app · Verified</span>
                    </div>
                    <button className="admin-mfa-remove-button" disabled={working} onClick={() => setFactorPendingRemoval({ ...factor, displayName: factorName })} type="button">
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg>
                      Remove
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          <div className="admin-mfa-footer">
            <div>
              <strong>{factors.length ? 'Protect against losing access' : `Secure this ${roleName.toLowerCase()} account`}</strong>
              <p>{factors.length ? 'Add another authenticator app or device as a backup.' : `Connect an authenticator app to require a code during ${roleName.toLowerCase()} sign-in.`}</p>
            </div>
            <button className="button" disabled={working} onClick={beginEnrollment} type="button">{factors.length ? 'Add backup authenticator' : 'Set up authenticator'}</button>
          </div>
          {factors.length === 1 && <div className="admin-mfa-recovery-note"><strong>Recovery reminder</strong><p>Supabase does not provide recovery codes. Add a backup authenticator before relying on two-factor authentication for this account.</p></div>}
        </>
      )}

      {factorPendingRemoval && createPortal(
        <div className="confirmation-backdrop admin-mfa-remove-backdrop" role="presentation">
          <section aria-labelledby="remove-authenticator-title" aria-modal="true" className="confirmation-dialog admin-mfa-remove-dialog" role="dialog">
            <div className="admin-mfa-remove-dialog-copy">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 9v4m0 3h.01M10.2 4.8 3.4 17a2 2 0 0 0 1.8 3h13.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" /></svg>
              </span>
              <div>
                <h2 id="remove-authenticator-title">Remove this authenticator?</h2>
                <p><strong>{factorPendingRemoval.displayName}</strong> will no longer generate valid verification codes for this {roleName.toLowerCase()} account.</p>
              </div>
            </div>
            {factors.length === 1 && <div className="admin-mfa-removal-warning">This is your only connected authenticator. Add a backup authenticator before removing it so this protected account cannot lose two-factor authentication.</div>}
            <div className="confirmation-actions">
              <button disabled={working} onClick={() => setFactorPendingRemoval(null)} type="button">Keep authenticator</button>
              <button className="danger-action" disabled={working || factors.length === 1} onClick={() => removeFactor(factorPendingRemoval.id)} type="button">{working ? 'Removing…' : factors.length === 1 ? 'Backup required' : 'Remove authenticator'}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
