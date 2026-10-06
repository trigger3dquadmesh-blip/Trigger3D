import { supabase } from '../../lib/supabase.js'

const modelUrlCache = new Map()
const CACHE_LIFETIME_MS = 50 * 60 * 1000

export function getFirearmModelUrl(storagePath) {
  if (!storagePath) return Promise.reject(new Error('This firearm does not have a model file.'))

  const cached = modelUrlCache.get(storagePath)
  if (cached?.promise) return cached.promise
  if (cached?.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url)

  const promise = supabase.storage
    .from('firearm-models')
    .createSignedUrl(storagePath, 3600)
    .then(({ data, error }) => {
      if (error) throw error
      if (!data?.signedUrl) throw new Error('The model link could not be created.')
      modelUrlCache.set(storagePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + CACHE_LIFETIME_MS,
      })
      return data.signedUrl
    })
    .catch((error) => {
      modelUrlCache.delete(storagePath)
      throw error
    })

  modelUrlCache.set(storagePath, { promise })
  return promise
}
