/* global Deno, atob */

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://trigger3d.vercel.app',
]

export function getCorsHeaders(request) {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const allowedOrigins = configuredOrigins.length ? configuredOrigins : defaultAllowedOrigins
  const requestOrigin = request?.headers?.get('Origin') || ''
  const allowedOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
  }
}

export function getJwtAssuranceLevel(accessToken) {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    return JSON.parse(decoded).aal || null
  } catch {
    return null
  }
}

export function validateStrongPassword(password) {
  if (password.length < 12) return 'Temporary password must contain at least 12 characters.'
  if (!/[a-z]/.test(password)) return 'Temporary password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Temporary password must include an uppercase letter.'
  if (!/\d/.test(password)) return 'Temporary password must include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Temporary password must include a symbol.'
  return ''
}
