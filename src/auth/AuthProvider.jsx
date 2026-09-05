import { useCallback, useEffect, useMemo, useState } from 'react'
import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { AuthContext } from './auth-context.js'

const demoProfiles = Object.freeze({
  'admin@trigger3d.demo': Object.freeze({
  id: 'demo-admin', email: 'admin@trigger3d.demo', full_name: 'Demo Administrator', role: 'admin',
  }),
  'student@trigger3d.demo': Object.freeze({
    id: 'demo-student', email: 'student@trigger3d.demo', full_name: 'Demo Student', role: 'student',
  }),
  'faculty@trigger3d.demo': Object.freeze({
    id: 'demo-faculty', email: 'faculty@trigger3d.demo', full_name: 'Demo Faculty', role: 'faculty',
  }),
})

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(isDemoMode ? false : isSupabaseConfigured)

  useEffect(() => {
    if (isDemoMode) return undefined
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
    if (isDemoMode) return { data: profile, error: null }
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
  }, [profile, session])

  const demoSignIn = useCallback((email, password) => {
    const demoProfile = demoProfiles[email.trim().toLowerCase()]
    if (!demoProfile || password !== 'demo12345') {
      return { error: new Error('Use one of the demo account credentials shown below.') }
    }
    setSession({ user: { id: demoProfile.id, email: demoProfile.email } })
    setProfile(demoProfile)
    return { error: null }
  }, [])

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      isDemoMode,
      loading,
      profile,
      profileError,
      refreshProfile,
      demoSignIn,
      role: profile?.disabled_at ? null : (profile?.role ?? null),
      session,
      user: session?.user ?? null,
      signOut: () => {
        if (isDemoMode) {
          setSession(null)
          setProfile(null)
          return Promise.resolve({ error: null })
        }
        return supabase?.auth.signOut()
      },
    }),
    [demoSignIn, loading, profile, profileError, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
