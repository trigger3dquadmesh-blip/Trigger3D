import { supabase } from '../../lib/supabase.js'

const modelUrlCache = new Map()
const CACHE_LIFETIME_MS = 50 * 60 * 1000

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

export function getFirearmModelUrl(storagePath, identifier = '', name = '') {
  const bundledUrl = getBundledFirearmModelUrl(identifier, name)
  if (bundledUrl) return Promise.resolve(bundledUrl)

  const normalizedStoragePath = normalizeStoragePath(storagePath)
  if (!normalizedStoragePath) {
    return Promise.reject(new Error('This firearm does not have a model file.'))
  }

  const cached = modelUrlCache.get(normalizedStoragePath)
  if (cached?.promise) return cached.promise
  if (cached?.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url)

  const promise = supabase.storage
    .from('firearm-models')
    .createSignedUrl(normalizedStoragePath, 3600)
    .then(({ data, error }) => {
      if (error) throw error
      if (!data?.signedUrl) throw new Error('The model link could not be created.')
      modelUrlCache.set(normalizedStoragePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + CACHE_LIFETIME_MS,
      })
      return data.signedUrl
    })
    .catch((error) => {
      modelUrlCache.delete(normalizedStoragePath)
      throw error
    })

  modelUrlCache.set(normalizedStoragePath, { promise })
  return promise
}
