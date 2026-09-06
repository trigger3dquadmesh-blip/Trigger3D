import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { AuthContext } from './auth-context.js'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    let active = true

    async function applySession(nextSession) {
      if (!active) return

      setSession(nextSession)
      setProfileError('')

      if (!nextSession?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at, disabled_at, avatar_url')
        .eq('id', nextSession.user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        setProfile(null)
        setProfileError(error.message)
      } else if (!data) {
        setProfile(null)
        setProfileError('No account profile was found. Run the Trigger3D roles migration in Supabase.')
      } else {
        setProfile(data)
        setProfileError(data.disabled_at ? 'This account has been disabled. Contact an administrator.' : '')
      }

      setLoading(false)
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return

      if (error) {
        setProfileError(error.message)
        setLoading(false)
        return
      }

      void applySession(data.session)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void applySession(nextSession)
      },
    )

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return { data: null, error: null }

    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, disabled_at, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      setProfileError(error.message)
    } else {
      setProfile(data)
      setProfileError(
        data?.disabled_at
          ? 'This account has been disabled. Contact an administrator.'
          : data
            ? ''
            : 'No account profile was found.',
      )
    }

    setLoading(false)
    return { data, error }
  }, [session])

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      loading,
      profile,
      profileError,
      refreshProfile,
      role: profile?.disabled_at ? null : (profile?.role ?? null),
      session,
      user: session?.user ?? null,
      signOut: () => supabase?.auth.signOut(),
    }),
    [loading, profile, profileError, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
