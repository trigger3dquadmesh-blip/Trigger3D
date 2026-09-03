import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const emptyData = {
  profiles: [],
  firearms: [],
  classes: [],
  assessmentCount: 0,
}

export default function useAdminLiveData() {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const [profilesResult, firearmsResult, classesResult, attemptsResult, componentsResult] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, role, created_at, disabled_at').order('created_at', { ascending: false }),
      supabase.from('firearms').select('id, identifier, name, caliber, description, status, created_at, glb_storage_path').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, archived_at'),
      supabase.from('assessment_attempts').select('id, firearm_id'),
      supabase.from('firearm_components').select('id, firearm_id'),
    ])
    const requestError = profilesResult.error || firearmsResult.error || classesResult.error || attemptsResult.error || componentsResult.error
    setData({
      profiles: profilesResult.data ?? [],
      firearms: (firearmsResult.data ?? []).map((firearm) => ({
        ...firearm,
        component_count: (componentsResult.data ?? []).filter((component) => component.firearm_id === firearm.id).length,
        assessment_count: (attemptsResult.data ?? []).filter((attempt) => attempt.firearm_id === firearm.id).length,
      })),
      classes: classesResult.data ?? [],
      assessmentCount: (attemptsResult.data ?? []).length,
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
