import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { AuthContext } from './auth-context.js'
import { resolveProfileAvatar } from './profile-avatar.js'
import { privilegedIdleTimeoutMs, requiresPrivilegedIdleTimeout } from './session-security.js'

const profileFields = 'id, email, full_name, role, created_at, disabled_at, avatar_url'
const profileRetryDelays = [0, 250, 700]

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function loadProfile(userId) {
  let lastResult = { data: null, error: null }

  for (const delay of profileRetryDelays) {
    if (delay) await wait(delay)
    lastResult = await supabase
      .from('profiles')
      .select(profileFields)
      .eq('id', userId)
      .maybeSingle()

    if (!lastResult.error) return lastResult
  }

  return lastResult
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const profileRef = useRef(null)
  const sessionRequestRef = useRef(0)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    let active = true
    async function applySession(nextSession) {
      if (!active) return

      const requestId = sessionRequestRef.current + 1
      sessionRequestRef.current = requestId

      setSession(nextSession)
      setProfileError('')

      if (!nextSession?.user) {
        profileRef.current = null
        setProfile(null)
        setLoading(false)
        return
      }

      const hasCurrentProfile = profileRef.current?.id === nextSession.user.id
      if (!hasCurrentProfile) setLoading(true)

      const { data, error } = await loadProfile(nextSession.user.id)

      if (!active || requestId !== sessionRequestRef.current) return

      if (error) {
        // Token refreshes and tab focus can briefly overlap. Preserve a valid
        // profile instead of replacing the account with a transient failure.
        if (!hasCurrentProfile) {
          profileRef.current = null
          setProfile(null)
          setProfileError(error.message)
        }
      } else if (!data) {
        profileRef.current = null
        setProfile(null)
        setProfileError('No account profile was found. Run the Trigger3D roles migration in Supabase.')
      } else {
        const resolvedProfile = await resolveProfileAvatar(data)
        if (!active || requestId !== sessionRequestRef.current) return
        profileRef.current = resolvedProfile
        setProfile(resolvedProfile)
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

  useEffect(() => {
    if (!session?.user || !requiresPrivilegedIdleTimeout(profile?.role)) return undefined

    let timeoutId
    const expireSession = () => {
      void supabase.auth.signOut()
    }
    const scheduleExpiration = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(expireSession, privilegedIdleTimeoutMs)
    }
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, scheduleExpiration, { passive: true }))
    scheduleExpiration()

    return () => {
      window.clearTimeout(timeoutId)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, scheduleExpiration))
    }
  }, [profile?.role, session?.user])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return { data: null, error: null }

    setLoading(true)
    const requestId = sessionRequestRef.current + 1
    sessionRequestRef.current = requestId
    const { data, error } = await loadProfile(session.user.id)

    let resolvedData = data
    if (error) {
      if (!profileRef.current || profileRef.current.id !== session.user.id) {
        setProfileError(error.message)
      }
    } else {
      resolvedData = await resolveProfileAvatar(data)
      if (requestId !== sessionRequestRef.current) return { data: null, error: null }
      profileRef.current = resolvedData
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
