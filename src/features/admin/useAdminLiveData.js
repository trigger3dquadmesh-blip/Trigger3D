import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const emptyData = {
  profiles: [],
  firearms: [],
  classes: [],
  auditEvents: [],
  assessmentCount: 0,
}

export default function useAdminLiveData() {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const [profilesResult, firearmsResult, classesResult, attemptsResult, componentsResult, auditResult] = await Promise.all([
      supabase.rpc('get_admin_profiles'),
      supabase.from('firearms').select('id, identifier, name, caliber, description, status, created_at, glb_storage_path').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, archived_at'),
      supabase.from('assessment_attempts').select('id, firearm_id, status'),
      supabase.from('firearm_components').select('id, firearm_id'),
      supabase.from('audit_events').select('id, actor_id, event_type, entity_type, entity_id, record_label, reason, created_at, actor:profiles!audit_events_actor_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(200),
    ])
    const requestError = profilesResult.error || firearmsResult.error || classesResult.error || attemptsResult.error || componentsResult.error || auditResult.error
    const submittedAttempts = (attemptsResult.data ?? []).filter((attempt) => attempt.status === 'submitted')

    setData({
      profiles: profilesResult.data ?? [],
      firearms: (firearmsResult.data ?? []).map((firearm) => ({
        ...firearm,
        component_count: (componentsResult.data ?? []).filter((component) => component.firearm_id === firearm.id).length,
        assessment_count: submittedAttempts.filter((attempt) => attempt.firearm_id === firearm.id).length,
      })),
      classes: classesResult.data ?? [],
      auditEvents: auditResult.data ?? [],
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

  return { data, error, loading, reload }
}
