// Sends landing-page contact messages to the team inbox through Web3Forms
// (https://web3forms.com), a form-to-email service. The access key is meant
// to be public in website code: it only lets this form email the inbox it
// was registered with.
//
// To turn sending on, set VITE_WEB3FORMS_ACCESS_KEY (in .env.local and in
// Vercel's environment variables). Until then the form falls back to opening
// the visitor's email app, plus a "Copy email" option.

export const CONTACT_EMAIL = 'trigger3d.quadmesh@gmail.com'
export const WEB3FORMS_ACCESS_KEY = import.meta.env?.VITE_WEB3FORMS_ACCESS_KEY ?? ''
const WEB3FORMS_URL = 'https://api.web3forms.com/submit'

/**
 * @returns {Promise<{ status: 'sent' | 'failed' | 'no-service' }>}
 */
export async function sendContactMessage(
  { name, email, subject, message, botcheck },
  { accessKey = WEB3FORMS_ACCESS_KEY, fetchImpl = globalThis.fetch } = {},
) {
  // Hidden "botcheck" field: real people never tick it, spam bots usually do.
  // Pretend success so bots get no signal.
  if (botcheck) return { status: 'sent' }
  if (!accessKey) return { status: 'no-service' }

  try {
    const response = await fetchImpl(WEB3FORMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        from_name: 'Trigger3D website',
        name,
        email,
        subject: subject || 'Trigger3D inquiry',
        message,
      }),
    })
    const result = await response.json().catch(() => ({}))
    return { status: response.ok && result.success ? 'sent' : 'failed' }
  } catch {
    return { status: 'failed' }
  }
}

/** Opens the visitor's email app with the message pre-filled (fallback). */
export function buildMailtoUrl(to, { name, email, subject, message }) {
  const signature = [name && `From: ${name}`, `Reply to: ${email}`].filter(Boolean).join('\n')
  return `mailto:${to}?subject=${encodeURIComponent(subject || 'Trigger3D inquiry')}&body=${encodeURIComponent(`${message}\n\n${signature}`)}`
}
