-- Prevent Students from inspecting a firearm while its assessment is in progress.
-- Firearm summary rows remain visible so assessment pages can show names/results.

create or replace function private.student_has_in_progress_attempt(
  target_firearm_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessment_attempts
    where student_id = (select auth.uid())
      and firearm_id = target_firearm_id
      and status = 'in_progress'
  );
$$;

create or replace function private.can_inspect_firearm(target_firearm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.firearms as firearm
    where firearm.id = target_firearm_id
      and (
        (select private.current_user_role()) = 'admin'
        or (
          firearm.status = 'ready'
          and (select private.current_user_role()) = 'faculty'
        )
        or (
          firearm.status = 'ready'
          and (select private.current_user_role()) = 'student'
          and (select private.has_any_active_enrollment())
          and not (select private.student_has_in_progress_attempt(firearm.id))
        )
      )
  );
$$;

create or replace function private.can_read_firearm_storage(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.firearms as firearm
    where firearm.glb_storage_path = object_name
      and (select private.can_inspect_firearm(firearm.id))
  );
$$;

revoke all on function private.student_has_in_progress_attempt(uuid) from public;
revoke all on function private.can_inspect_firearm(uuid) from public;
revoke all on function private.can_read_firearm_storage(text) from public;
grant execute on function private.student_has_in_progress_attempt(uuid) to authenticated;
grant execute on function private.can_inspect_firearm(uuid) to authenticated;
grant execute on function private.can_read_firearm_storage(text) to authenticated;

drop policy if exists "Authorized users can view firearm components"
on public.firearm_components;
create policy "Authorized users can view firearm components"
on public.firearm_components
for select
to authenticated
using ((select private.can_inspect_firearm(firearm_id)));
