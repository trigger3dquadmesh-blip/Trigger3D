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
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const nextKey = `trigger3d.auth.${randomId}`

  // A fresh key prevents Supabase auth broadcasts from replacing the account
  // in another open Trigger3D tab. Copying the current value keeps refreshes
  // signed in, including tabs created by duplicating an existing tab.
  if (previousKey) {
    const currentSession = window.sessionStorage.getItem(previousKey)
    if (currentSession) window.sessionStorage.setItem(nextKey, currentSession)
    window.sessionStorage.removeItem(previousKey)
  } else if (supabaseUrl) {
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
