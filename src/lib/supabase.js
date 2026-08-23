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
// Demo mode is used only when no real Supabase connection is available.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' && !hasSupabaseCredentials

export const isSupabaseConfigured = Boolean(
  hasSupabaseCredentials || isDemoMode,
)

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null
