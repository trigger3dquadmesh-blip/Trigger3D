import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHOWCASE_ENTRY_PARAM,
  SHOWCASE_SESSION_KEY,
  SHOWCASE_SESSION_MS,
  resolveShowcaseSession,
} from '../src/features/showcase/showcase-session.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
    values,
  }
}

const NOW = Date.parse('2026-11-17T09:00:00Z')
const scanned = `?${SHOWCASE_ENTRY_PARAM}=1`

test('scanning the QR code starts a one-hour session', () => {
  const storage = createStorage()
  const session = resolveShowcaseSession({ search: scanned, now: NOW, storage })
  assert.equal(session.status, 'active')
  assert.equal(session.expiresAt, NOW + SHOWCASE_SESSION_MS)
  assert.equal(session.remainingMs, SHOWCASE_SESSION_MS)
  assert.equal(session.cameFromScan, true)
  assert.equal(JSON.parse(storage.values.get(SHOWCASE_SESSION_KEY)).startedAt, NOW)
})

test('reopening without scanning keeps the same session until the hour ends', () => {
  const storage = createStorage()
  resolveShowcaseSession({ search: scanned, now: NOW, storage })
  const later = resolveShowcaseSession({ search: '', now: NOW + 59 * 60 * 1000, storage })
  assert.equal(later.status, 'active')
  assert.equal(later.cameFromScan, false)
  assert.equal(later.remainingMs, 60 * 1000)
})

test('the session expires after one hour', () => {
  const storage = createStorage()
  resolveShowcaseSession({ search: scanned, now: NOW, storage })
  const expired = resolveShowcaseSession({ search: '', now: NOW + SHOWCASE_SESSION_MS, storage })
  assert.equal(expired.status, 'expired')
  assert.equal(expired.remainingMs, 0)
})

test('scanning again after expiry starts a fresh hour', () => {
  const storage = createStorage()
  resolveShowcaseSession({ search: scanned, now: NOW, storage })
  const rescanAt = NOW + 2 * SHOWCASE_SESSION_MS
  const fresh = resolveShowcaseSession({ search: scanned, now: rescanAt, storage })
  assert.equal(fresh.status, 'active')
  assert.equal(fresh.expiresAt, rescanAt + SHOWCASE_SESSION_MS)
})

test('opening the link without ever scanning shows the scan prompt', () => {
  const session = resolveShowcaseSession({ search: '', now: NOW, storage: createStorage() })
  assert.equal(session.status, 'not-started')
})

test('a damaged or future-dated saved session is not trusted', () => {
  const garbage = resolveShowcaseSession({
    search: '', now: NOW, storage: createStorage({ [SHOWCASE_SESSION_KEY]: 'not json' }),
  })
  assert.equal(garbage.status, 'not-started')
  const future = resolveShowcaseSession({
    search: '', now: NOW,
    storage: createStorage({ [SHOWCASE_SESSION_KEY]: JSON.stringify({ startedAt: NOW + 60 * 60 * 1000 }) }),
  })
  assert.equal(future.status, 'not-started')
})

test('a scan still works for this visit when browser storage is blocked', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  const session = resolveShowcaseSession({ search: scanned, now: NOW, storage: blocked })
  assert.equal(session.status, 'active')
  assert.equal(resolveShowcaseSession({ search: '', now: NOW, storage: blocked }).status, 'not-started')
})
