-- Allow authorized users to read only GLBs represented by visible firearm rows.
-- The firearm-models bucket remains private.

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
      and (select private.can_view_firearm(firearm.id))
  );
$$;

revoke all on function private.can_read_firearm_storage(text) from public;
grant execute on function private.can_read_firearm_storage(text) to authenticated;

drop policy if exists "Authorized users can read imported firearm models"
on storage.objects;
create policy "Authorized users can read imported firearm models"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'firearm-models'
  and (select private.can_read_firearm_storage(name))
);
