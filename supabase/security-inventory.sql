-- READ-ONLY: run this entire file in the Supabase SQL Editor.
-- It changes nothing. Download or copy each result grid for the security review.

-- 1. Public tables, RLS status, and forced-RLS status.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

-- 2. Every row-level security policy and its rule.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, cmd, policyname;

-- 3. Table privileges exposed to signed-out and signed-in API callers.
select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated')
group by table_schema, table_name, grantee
order by table_schema, table_name, grantee;

-- 4. Public functions, whether they bypass caller permissions, and their ACLs.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  p.proconfig as configured_settings,
  coalesce(array_to_string(p.proacl, E'\n'), 'DEFAULT PRIVILEGES') as access_control
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- 5. Storage buckets and whether their contents are public.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- 6. Views in exposed schemas. Views require separate RLS/security review.
select
  schemaname,
  viewname,
  viewowner,
  definition
from pg_views
where schemaname = 'public'
order by viewname;

-- 7. Triggers that create profiles, assign roles, or log activity.
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by event_object_schema, event_object_table, trigger_name;
