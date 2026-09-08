import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { AuthContext } from './auth-context.js'
import { resolveProfileAvatar } from './profile-avatar.js'
import { hasActiveAssessmentSession } from '../features/student/assessment/assessment-session.js'

const awayTimestampKey = 'trigger3d.auth.away-at'
const awaySignOutDelay = 30_000

function readAwayTimestamp() {
  try {
    return Number(sessionStorage.getItem(awayTimestampKey)) || 0
  } catch {
    return 0
  }
}

function clearAwayTimestamp() {
  try {
    sessionStorage.removeItem(awayTimestampKey)
  } catch {
    // Session storage can be unavailable in restrictive browser modes.
  }
}

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
    let awayAtMemory = readAwayTimestamp()
    let activeUserId = ''

    async function applySession(nextSession) {
      if (!active) return

      activeUserId = nextSession?.user?.id || ''
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
        const resolvedProfile = await resolveProfileAvatar(data)
        if (!active) return
        setProfile(resolvedProfile)
        setProfileError(data.disabled_at ? 'This account has been disabled. Contact an administrator.' : '')
      }

      setLoading(false)
    }

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return

      if (error) {
        setProfileError(error.message)
        setLoading(false)
        return
      }

      const awayAt = readAwayTimestamp()
      if (data.session
        && hasActiveAssessmentSession(sessionStorage, data.session.user.id)
        && awayAt
        && Date.now() - awayAt >= awaySignOutDelay) {
        awayAtMemory = 0
        clearAwayTimestamp()
        await supabase.auth.signOut()
        if (active) void applySession(null)
        return
      }

      awayAtMemory = 0
      clearAwayTimestamp()
      void applySession(data.session)
    })

    function markUserAway() {
      if (!hasActiveAssessmentSession(sessionStorage, activeUserId)) {
        awayAtMemory = 0
        clearAwayTimestamp()
        return
      }
      if (!awayAtMemory) awayAtMemory = Date.now()
      try {
        sessionStorage.setItem(awayTimestampKey, String(awayAtMemory))
      } catch {
        // The in-memory timestamp still supports the current page session.
      }
    }

    function checkWhetherSessionExpired() {
      const awayAt = awayAtMemory || readAwayTimestamp()
      awayAtMemory = 0
      clearAwayTimestamp()
      if (hasActiveAssessmentSession(sessionStorage, activeUserId)
        && awayAt
        && Date.now() - awayAt >= awaySignOutDelay) {
        void supabase.auth.signOut()
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') markUserAway()
      else checkWhetherSessionExpired()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', markUserAway)
    window.addEventListener('focus', checkWhetherSessionExpired)
    window.addEventListener('pagehide', markUserAway)

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void applySession(nextSession)
      },
    )

    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', markUserAway)
      window.removeEventListener('focus', checkWhetherSessionExpired)
      window.removeEventListener('pagehide', markUserAway)
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

    let resolvedData = data
    if (error) {
      setProfileError(error.message)
    } else {
      resolvedData = await resolveProfileAvatar(data)
      setProfile(resolvedData)
      setProfileError(
        data?.disabled_at
          ? 'This account has been disabled. Contact an administrator.'
          : data
            ? ''
            : 'No account profile was found.',
      )
    }

    setLoading(false)
    return { data: resolvedData, error }
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
