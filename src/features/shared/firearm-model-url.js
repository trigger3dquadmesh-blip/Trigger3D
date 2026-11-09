import { supabase } from '../../lib/supabase.js'

const modelUrlCache = new Map()
const CACHE_LIFETIME_MS = 50 * 60 * 1000
const SIGNED_URL_RETRY_DELAY_MS = 350

function normalizeStoragePath(storagePath) {
  let path = String(storagePath || '').trim()
  if (!path) return ''

  try {
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path)
      const marker = '/firearm-models/'
      const markerIndex = url.pathname.indexOf(marker)
      path = markerIndex >= 0 ? url.pathname.slice(markerIndex + marker.length) : url.pathname
    }
  } catch {
    // Keep the original value so the caller receives a useful storage error.
  }

  try {
    path = decodeURIComponent(path)
  } catch {
    // A malformed legacy value can still be passed to Storage for diagnosis.
  }
  path = path.replace(/^\/+/, '')
  return path.replace(/^firearm-models\//i, '')
}

export function getBundledFirearmModelUrl(identifier, name = '') {
  void identifier
  void name
  return ''
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function createModelSignedUrl(storagePath) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.storage
      .from('firearm-models')
      .createSignedUrl(storagePath, 3600)

    if (!error && data?.signedUrl) return data.signedUrl
    lastError = error || new Error('The model link could not be created.')
    if (attempt === 0) {
      // A tab can retain a valid-looking local session while its access token
      // has already become stale. Revalidate it before retrying the private
      // Storage request so Student, Faculty, and Admin viewers behave alike.
      const { error: userError } = await supabase.auth.getUser()
      if (userError) {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) lastError = refreshError
      }
      await wait(SIGNED_URL_RETRY_DELAY_MS)
    }
  }
  throw lastError
}

export async function getFirearmModelUrl(storagePath, identifier = '', name = '') {
  const bundledUrl = getBundledFirearmModelUrl(identifier, name)
  if (bundledUrl) return bundledUrl

  const normalizedStoragePath = normalizeStoragePath(storagePath)
  if (!normalizedStoragePath) {
    throw new Error('This firearm does not have a model file.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const viewerId = sessionData.session?.user?.id || 'anonymous'
  const cacheKey = `${viewerId}:${normalizedStoragePath}`

  const cached = modelUrlCache.get(cacheKey)
  if (cached?.promise) return cached.promise
  if (cached?.url && cached.expiresAt > Date.now()) return cached.url

  const promise = createModelSignedUrl(normalizedStoragePath)
    .then((signedUrl) => {
      modelUrlCache.set(cacheKey, {
        url: signedUrl,
        expiresAt: Date.now() + CACHE_LIFETIME_MS,
      })
      return signedUrl
    })
    .catch((error) => {
      modelUrlCache.delete(cacheKey)
      const inaccessible = /not found|does not exist|permission|policy|unauthorized/i.test(error?.message || '')
      throw new Error(inaccessible
        ? 'The 3D model file could not be accessed. Please retry. If the problem continues, the firearm Storage access policy must be updated.'
        : error?.message || 'The model link could not be created.')
    })

  modelUrlCache.set(cacheKey, { promise })
  return promise
}
