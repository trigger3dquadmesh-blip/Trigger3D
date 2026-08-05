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

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAllowedEmail(email, allowedDomain) {
  const parts = email.split('@')
  return parts.length === 2 && Boolean(parts[0]) && parts[1] === allowedDomain
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
      return jsonResponse({ error: 'Only active Admin accounts can perform this action.' }, 403)
    }

    const body = await request.json()
    if (body.action === 'create_faculty') {
      const email = normalizeEmail(body.email)
      const fullName = normalizeName(body.full_name)
      const password = typeof body.password === 'string' ? body.password : ''
      const allowedDomain = (Deno.env.get('ALLOWED_EMAIL_DOMAIN') || 'parsu.edu.ph').toLowerCase()

      if (!isAllowedEmail(email, allowedDomain)) {
        return jsonResponse({ error: `Faculty email must use the @${allowedDomain} domain.` }, 400)
      }
      if (fullName.length < 2 || fullName.length > 100) {
        return jsonResponse({ error: 'Full name must contain between 2 and 100 characters.' }, 400)
      }
      if (password.length < 8) {
        return jsonResponse({ error: 'Temporary password must contain at least 8 characters.' }, 400)
      }

      const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createError) return jsonResponse({ error: createError.message }, 400)

      const { data: profile, error: roleError } = await adminClient
        .from('profiles')
        .update({ full_name: fullName, role: 'faculty', disabled_at: null })
        .eq('id', createdData.user.id)
        .select('id, email, full_name, role')
        .single()

      if (roleError) {
        await adminClient.auth.admin.deleteUser(createdData.user.id)
        return jsonResponse({ error: `The Auth user was rolled back because its Faculty profile could not be created: ${roleError.message}` }, 500)
      }

      return jsonResponse({ user: profile }, 201)
    }

    if (body.action === 'delete_user') {
      const targetUserId = typeof body.user_id === 'string' ? body.user_id : ''
      if (!targetUserId) return jsonResponse({ error: 'A user ID is required.' }, 400)
      if (targetUserId === userData.user.id) return jsonResponse({ error: 'You cannot delete your own Admin account.' }, 400)

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)
      if (!deleteError) {
        return jsonResponse({ deleted_user_id: targetUserId, deletion_mode: 'permanent' })
      }

      // Supabase cannot hard-delete Auth users who own Storage objects. Soft-delete
      // the Auth identity, then remove Trigger3D data through the profile cascades.
      const { error: softDeleteError } = await adminClient.auth.admin.deleteUser(
        targetUserId,
        true,
      )
      if (softDeleteError) {
        return jsonResponse({
          error: `Permanent deletion failed: ${deleteError.message}. Fallback deletion also failed: ${softDeleteError.message}`,
        }, 400)
      }

      await adminClient
        .from('profiles')
        .update({ disabled_at: new Date().toISOString() })
        .eq('id', targetUserId)

      const { error: profileDeleteError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', targetUserId)
      if (profileDeleteError) {
        return jsonResponse({
          error: `The Auth identity was disabled, but Trigger3D record cleanup failed: ${profileDeleteError.message}. Run migration 016 and try deleting the remaining profile again.`,
        }, 500)
      }

      return jsonResponse({
        deleted_user_id: targetUserId,
        deletion_mode: 'anonymized',
        deletion_warning: 'Supabase retained an anonymized Auth tombstone because this user owned a Storage object. The account cannot sign in, and its Trigger3D profile and dependent records were removed.',
      })
    }

    return jsonResponse({ error: 'Unknown account-management action.' }, 400)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
