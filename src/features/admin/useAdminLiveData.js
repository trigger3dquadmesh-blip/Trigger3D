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

export default function useAdminLiveData() {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const [profilesResult, firearmsResult, classesResult, termsResult, attemptsResult, componentsResult, auditResult, authUsersResult] = await Promise.all([
      supabase.rpc('get_admin_profiles'),
      supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name, subject_name, section, term, academic_term_id, archived_at'),
      supabase.from('academic_terms').select('id, academic_year, semester, start_date, end_date, status').order('start_date', { ascending: false }),
      supabase.from('assessment_attempts').select('id, firearm_id, status'),
      supabase.from('firearm_components').select('id, firearm_id'),
      supabase.from('audit_events').select('id, actor_id, event_type, entity_type, entity_id, record_label, reason, academic_term_id, class_id, details, created_at, actor:profiles!audit_events_actor_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(500),
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'firearms' }, () => { void reload() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_events' }, () => { void reload() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [reload])

  return { data, error, loading, reload }
}
