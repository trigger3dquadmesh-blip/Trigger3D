// Time-limited access for the public /demo showcase.
//
// The booth QR code opens /demo?qr=1. Opening the page with that marker starts
// (or restarts) a one-hour session saved in this browser; the page then removes
// the marker from the address bar. Refreshing, bookmarking, or sharing the
// cleaned link does not extend the hour; scanning the QR code again does.
//
// This is a courtesy limit that ties the demo to the booth, not a security
// control: everything shown on /demo is intended to be public.

export const SHOWCASE_ENTRY_PARAM = 'qr'
export const SHOWCASE_SESSION_KEY = 'trigger3d.showcase.session'
export const SHOWCASE_SESSION_MS = 60 * 60 * 1000
// Small allowance for clocks that drift; anything further in the future is invalid.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

function readStartedAt(storage, now) {
  try {
    const saved = JSON.parse(storage.getItem(SHOWCASE_SESSION_KEY) ?? 'null')
    const startedAt = Number(saved?.startedAt)
    if (!Number.isFinite(startedAt) || startedAt > now + FUTURE_TOLERANCE_MS) return null
    return startedAt
  } catch {
    return null
  }
}

function saveStartedAt(storage, startedAt) {
  try {
    storage.setItem(SHOWCASE_SESSION_KEY, JSON.stringify({ startedAt }))
  } catch {
    // Storage blocked (e.g. some private modes): the session lasts for this visit only.
  }
}

/**
 * Works out whether the visitor may use the showcase right now.
 * @returns {{ status: 'active' | 'expired' | 'not-started', startedAt: number | null,
 *   expiresAt: number | null, remainingMs: number, cameFromScan: boolean }}
 */
export function resolveShowcaseSession({ search = '', now = Date.now(), storage }) {
  const cameFromScan = new URLSearchParams(search).has(SHOWCASE_ENTRY_PARAM)
  let startedAt = readStartedAt(storage, now)

  if (cameFromScan) {
    startedAt = now
    saveStartedAt(storage, startedAt)
  }

  if (startedAt === null) {
    return { status: 'not-started', startedAt: null, expiresAt: null, remainingMs: 0, cameFromScan }
  }

  const expiresAt = startedAt + SHOWCASE_SESSION_MS
  const remainingMs = Math.max(0, expiresAt - now)
  return { status: remainingMs > 0 ? 'active' : 'expired', startedAt, expiresAt, remainingMs, cameFromScan }
}

/** Same address without the QR marker, so refreshing or sharing doesn't restart the hour. */
export function stripShowcaseEntryParam(href) {
  const url = new URL(href)
  url.searchParams.delete(SHOWCASE_ENTRY_PARAM)
  return `${url.pathname}${url.search}${url.hash}`
}
