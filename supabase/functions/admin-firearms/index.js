/* global Deno, Response */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders, getJwtAssuranceLevel } from '../_shared/security.js'

function jsonResponse(body, status = 200, corsHeaders = getCorsHeaders()) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration is incomplete.' }, 500, corsHeaders)
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication is required.' }, 401, corsHeaders)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const accessToken = authorization.slice('Bearer '.length)
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) return jsonResponse({ error: 'Your session is invalid or expired.' }, 401, corsHeaders)

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, disabled_at')
      .eq('id', userData.user.id)
      .single()
    if (profileError || callerProfile?.role !== 'admin' || callerProfile.disabled_at) {
      return jsonResponse({ error: 'Only active Admin accounts can manage firearms.' }, 403, corsHeaders)
    }
    if (getJwtAssuranceLevel(accessToken) !== 'aal2') {
      return jsonResponse({ error: 'Two-factor verification is required for this administrator action.' }, 403, corsHeaders)
    }

    const body = await request.json()
    if (body.action !== 'delete_firearm' || typeof body.firearm_id !== 'string') {
      return jsonResponse({ error: 'A valid firearm deletion request is required.' }, 400)
    }

    const { data: firearm, error: deleteError } = await adminClient
      .from('firearms')
      .delete()
      .eq('id', body.firearm_id)
      .select('id, identifier, name, glb_storage_path')
      .single()
    if (deleteError) return jsonResponse({ error: deleteError.message }, 400)

    const { error: storageError } = await adminClient.storage
      .from('firearm-models')
      .remove([firearm.glb_storage_path])

    const { error: auditError } = await adminClient.from('audit_events').insert({
      actor_id: userData.user.id,
      // Deleted records may no longer satisfy an audit entity foreign key.
      // The immutable name and deletion details remain available below.
      entity_id: null,
      entity_type: 'firearm',
      event_type: 'Firearm deleted',
      reason: 'Permanently deleted from the firearm library.',
      record_label: firearm.name,
    })

    return jsonResponse({
      firearm,
      audit_warning: auditError ? `Activity logging failed: ${auditError.message}` : null,
      storage_warning: storageError
        ? `The database records were deleted, but Storage cleanup failed: ${storageError.message}`
        : null,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
