/* global Deno, Response */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration is incomplete.' }, 500)
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication is required.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const accessToken = authorization.slice('Bearer '.length)
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) return jsonResponse({ error: 'Your session is invalid or expired.' }, 401)

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, disabled_at')
      .eq('id', userData.user.id)
      .single()
    if (profileError || callerProfile?.role !== 'admin' || callerProfile.disabled_at) {
      return jsonResponse({ error: 'Only active Admin accounts can manage firearms.' }, 403)
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

    return jsonResponse({
      firearm,
      storage_warning: storageError
        ? `The database records were deleted, but Storage cleanup failed: ${storageError.message}`
        : null,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
