import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY

const hasPlaceholderCredentials =
  !supabaseUrl
  || !supabasePublishableKey
  || supabaseUrl.includes('your-project.supabase.co')
  || supabasePublishableKey.includes('your-key')

const hasSupabaseCredentials = !hasPlaceholderCredentials
export const isSupabaseConfigured = hasSupabaseCredentials

const authStoragePointerKey = 'trigger3d.auth.storage-key'

function createIsolatedAuthStorageKey() {
  const previousKey = window.sessionStorage.getItem(authStoragePointerKey)
  // sessionStorage is already scoped to a browser tab. Reuse the same key on
  // refresh so the saved Supabase session cannot disappear while the app is
  // being reloaded. A newly opened tab without a pointer still gets its own
  // key, allowing different accounts to remain signed in independently.
  if (previousKey) return previousKey

  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const nextKey = `trigger3d.auth.${randomId}`

  // Migrate the older fixed Supabase key once. New tabs then receive their own
  // randomly named session entry, while reloads retain the pointer above.
  if (supabaseUrl) {
    const projectReference = new URL(supabaseUrl).hostname.split('.')[0]
    const legacyKey = `sb-${projectReference}-auth-token`
    const legacySession = window.sessionStorage.getItem(legacyKey)
    if (legacySession) window.sessionStorage.setItem(nextKey, legacySession)
    window.sessionStorage.removeItem(legacyKey)
  }

  window.sessionStorage.setItem(authStoragePointerKey, nextKey)
  return nextKey
}

const authStorageKey = hasSupabaseCredentials
  ? createIsolatedAuthStorageKey()
  : undefined

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        storage: window.sessionStorage,
        storageKey: authStorageKey,
      },
    })
  : null
