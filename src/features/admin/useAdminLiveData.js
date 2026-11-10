import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const emptyData = {
  profiles: [],
  firearms: [],
  classes: [],
  academicTerms: [],
  auditEvents: [],
  attempts: [],
  componentCount: 0,
  assessmentCount: 0,
}

const AUDIT_BATCH_SIZE = 500
const auditEventSelection = 'id, actor_id, event_type, entity_type, entity_id, record_label, reason, academic_term_id, class_id, details, created_at, actor:profiles!audit_events_actor_id_fkey(full_name, email)'

async function loadCompleteAuditHistory() {
  const auditEvents = []

  for (let from = 0; ; from += AUDIT_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('audit_events')
      .select(auditEventSelection)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + AUDIT_BATCH_SIZE - 1)

    if (error) return { data: auditEvents, error }

    const batch = data ?? []
    auditEvents.push(...batch)
    if (batch.length < AUDIT_BATCH_SIZE) return { data: auditEvents, error: null }
  }
}

export default function useAdminLiveData() {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reloadAccounts = useCallback(async () => {
    const [profilesResult, authUsersResult] = await Promise.all([
      supabase.rpc('get_admin_profiles'),
      supabase.functions.invoke('admin-users', { body: { action: 'list_users' } }),
    ])
    const requestError = profilesResult.error || authUsersResult.error
    if (requestError) return { error: requestError }

    const authUsersById = new Map((authUsersResult.data?.users ?? []).map((authUser) => [authUser.id, authUser]))
    const profiles = (profilesResult.data ?? []).map((profile) => {
      const authUser = authUsersById.get(profile.id)
      return authUser ? { ...profile, email: authUser.email || profile.email, created_at: authUser.created_at || profile.created_at, last_sign_in_at: authUser.last_sign_in_at || profile.last_sign_in_at } : profile
    })
    setData((current) => ({ ...current, profiles }))
    return { error: null }
  }, [])

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const [profilesResult, firearmsResult, classesResult, termsResult, attemptsResult, componentsResult, auditResult, authUsersResult] = await Promise.all([
      supabase.rpc('get_admin_profiles'),
      supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name, subject_name, section, term, academic_term_id, archived_at'),
      supabase.from('academic_terms').select('id, academic_year, semester, start_date, end_date, status').order('start_date', { ascending: false }),
      supabase.from('assessment_attempts').select('id, firearm_id, status, timer_started_at, has_activity'),
      supabase.from('firearm_components').select('id, firearm_id'),
      loadCompleteAuditHistory(),
      supabase.functions.invoke('admin-users', { body: { action: 'list_users' } }),
    ])
    const requestError = profilesResult.error || firearmsResult.error || classesResult.error || termsResult.error || attemptsResult.error || componentsResult.error || auditResult.error
    const submittedAttempts = (attemptsResult.data ?? []).filter((attempt) => attempt.status === 'submitted')

    const authUsersById = new Map((authUsersResult.data?.users ?? []).map((authUser) => [authUser.id, authUser]))

    setData({
      profiles: (profilesResult.data ?? []).map((profile) => {
        const authUser = authUsersById.get(profile.id)
        return authUser ? { ...profile, email: authUser.email || profile.email, created_at: authUser.created_at || profile.created_at, last_sign_in_at: authUser.last_sign_in_at || profile.last_sign_in_at } : profile
      }),
      firearms: (firearmsResult.data ?? []).map((firearm) => ({
        ...firearm,
        component_count: (componentsResult.data ?? []).filter((component) => component.firearm_id === firearm.id).length,
        assessment_count: submittedAttempts.filter((attempt) => attempt.firearm_id === firearm.id).length,
      })),
      classes: classesResult.data ?? [],
      academicTerms: termsResult.data ?? [],
      auditEvents: auditResult.data ?? [],
      attempts: attemptsResult.data ?? [],
      componentCount: (componentsResult.data ?? []).length,
      assessmentCount: submittedAttempts.length,
    })
    setError(requestError?.message || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    // All state changes happen after the awaited Supabase requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('admin-live-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'firearms' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_terms' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_attempts' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'firearm_components' }, () => { void reload({ silent: true }) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_events' }, () => { void reload({ silent: true }) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [reload])

  return { data, error, loading, reload, reloadAccounts }
}
