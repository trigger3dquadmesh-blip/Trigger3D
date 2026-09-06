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

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null
